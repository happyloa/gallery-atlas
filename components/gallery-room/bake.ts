/**
 * Lighting for the room is worked out once, on the CPU, and stored in small half-float
 * lightmaps. The room never changes, so paying for eight spotlights per pixel per frame
 * would buy nothing; baking also gives soft contact shadows, bounce light and corner
 * occlusion that realtime lights cannot do cheaply.
 *
 * Units match three.js' physical lights: a spot of `intensity` candela gives an
 * irradiance of intensity · cosθ / r², and a Lambert surface shows albedo / π of it.
 * The few realtime lights (they only shade frames and fittings) use the same numbers.
 *
 * A bake is prepared with createLightmapBake() and then run a few rows at a time, so
 * the caller can keep each stretch of work on the main thread short.
 */
import {
  ClampToEdgeWrapping,
  DataTexture,
  DataUtils,
  HalfFloatType,
  LinearFilter,
  RGBAFormat,
} from "three";
import type { Vec3 } from "./layout";

export interface BakeSurface {
  /** World position of the (u = 0, v = 0) corner. */
  origin: Vec3;
  uDir: Vec3;
  vDir: Vec3;
  /** uDir × vDir. */
  normal: Vec3;
  uLength: number;
  vLength: number;
}

export interface BakeSpot {
  position: Vec3;
  /** Unit vector the lamp points along. */
  direction: Vec3;
  /** cos(outer cone angle) and cos(inner cone angle), as three.js computes them. */
  cosOuter: number;
  cosInner: number;
  /** Candela. */
  intensity: number;
  color: Vec3;
}

/** A lit patch of wall re-radiating into the room (one-bounce stand-in). */
export interface BakeBounce {
  position: Vec3;
  normal: Vec3;
  /** Radiant intensity along the normal. */
  power: number;
  /** Softening radius squared, roughly the size of the lit patch. */
  radiusSq: number;
  color: Vec3;
}

/** A box standing proud of a surface (a frame, a label, a bench). */
export interface BakeOccluder {
  u: number;
  v: number;
  halfU: number;
  halfV: number;
  /** How far it stands off the surface, in metres. */
  depth: number;
}

export interface BakeLighting {
  spots: BakeSpot[];
  bounces: BakeBounce[];
  /** Flat fill irradiance, before occlusion. */
  ambient: Vec3;
}

export interface BakeOptions {
  /** Texels per metre. */
  density: number;
  occluders?: BakeOccluder[];
  /** Scales the ambient fill at v = 0 and v = vLength. */
  ambientRamp?: readonly [number, number];
  /** Darken toward the surface's edges, where it meets its neighbours. */
  edgeOcclusion?: number;
  /** Drop colour and keep luminance (used for the pictures themselves). */
  neutral?: boolean;
  /** Multiplies the result. */
  gain?: number;
  /**
   * 0..1: pulls the (gained) result toward 1. A picture should read as evenly lit, with
   * only a hint of the lamp's falloff, so its lightmap is flattened.
   */
  flatten?: number;
  maxSize?: number;
}

const smoothstep = (edge0: number, edge1: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
};

function boxDistance(u: number, v: number, box: BakeOccluder): number {
  const du = Math.abs(u - box.u) - box.halfU;
  const dv = Math.abs(v - box.v) - box.halfV;
  if (du > 0 && dv > 0) return Math.hypot(du, dv);
  return Math.max(du, dv);
}

/** Irradiance (RGB) arriving at a point with the given normal. No occlusion. */
export function irradianceAt(
  point: Vec3,
  normal: Vec3,
  lighting: BakeLighting,
): [number, number, number] {
  const out: [number, number, number] = [
    lighting.ambient[0],
    lighting.ambient[1],
    lighting.ambient[2],
  ];
  for (const spot of lighting.spots) {
    const lx = spot.position[0] - point[0];
    const ly = spot.position[1] - point[1];
    const lz = spot.position[2] - point[2];
    const distSq = lx * lx + ly * ly + lz * lz;
    const dist = Math.sqrt(distSq);
    const cosIncidence =
      (lx * normal[0] + ly * normal[1] + lz * normal[2]) / dist;
    if (cosIncidence <= 0) continue;
    const cosAngle =
      -(
        lx * spot.direction[0] +
        ly * spot.direction[1] +
        lz * spot.direction[2]
      ) / dist;
    if (cosAngle <= spot.cosOuter) continue;
    const e =
      (spot.intensity *
        smoothstep(spot.cosOuter, spot.cosInner, cosAngle) *
        cosIncidence) /
      Math.max(distSq, 0.01);
    out[0] += e * spot.color[0];
    out[1] += e * spot.color[1];
    out[2] += e * spot.color[2];
  }
  for (const bounce of lighting.bounces) {
    const dx = point[0] - bounce.position[0];
    const dy = point[1] - bounce.position[1];
    const dz = point[2] - bounce.position[2];
    const distSq = dx * dx + dy * dy + dz * dz;
    const dist = Math.sqrt(distSq) || 1e-6;
    const cosEmit =
      (dx * bounce.normal[0] + dy * bounce.normal[1] + dz * bounce.normal[2]) /
      dist;
    if (cosEmit <= 0) continue;
    const cosReceive =
      -(dx * normal[0] + dy * normal[1] + dz * normal[2]) / dist;
    if (cosReceive <= 0) continue;
    const e =
      (bounce.power * cosEmit * cosReceive) / (distSq + bounce.radiusSq);
    out[0] += e * bounce.color[0];
    out[1] += e * bounce.color[1];
    out[2] += e * bounce.color[2];
  }
  return out;
}

export interface LightmapBake {
  /** Usable straight away; its pixels arrive when the bake finishes. */
  texture: DataTexture;
  /**
   * Bakes rows until the lightmap is done or `outOfTime()` returns true, so a caller can
   * spread the work over several tasks. Returns true once finished.
   */
  run(outOfTime: () => boolean): boolean;
}

/**
 * Prepares the bake of one flat surface into an irradiance lightmap (linear, half-float
 * RGBA). `lighting` is read when the bake runs, not here.
 */
export function createLightmapBake(
  surface: BakeSurface,
  lighting: BakeLighting,
  options: BakeOptions,
): LightmapBake {
  const maxSize = options.maxSize ?? 1024;
  const width = Math.max(
    4,
    Math.min(maxSize, Math.round(surface.uLength * options.density)),
  );
  const height = Math.max(
    4,
    Math.min(maxSize, Math.round(surface.vLength * options.density)),
  );
  const occluders = options.occluders ?? [];
  const ramp = options.ambientRamp ?? [1, 1];
  const edge = options.edgeOcclusion ?? 0;
  const gain = options.gain ?? 1;
  const keep = 1 - (options.flatten ?? 0);
  const shape = (value: number) =>
    Math.min(keep < 1 ? 1 + (value * gain - 1) * keep : value * gain, 60000);
  const { origin, uDir, vDir, normal } = surface;
  const [nx, ny, nz] = normal;

  // Each lamp's position in this surface's own (u, v, height) frame, for shadows.
  const localSpots = () =>
    lighting.spots.map((spot) => {
      const dx = spot.position[0] - origin[0];
      const dy = spot.position[1] - origin[1];
      const dz = spot.position[2] - origin[2];
      return {
        u: dx * uDir[0] + dy * uDir[1] + dz * uDir[2],
        v: dx * vDir[0] + dy * vDir[1] + dz * vDir[2],
        h: dx * nx + dy * ny + dz * nz,
      };
    });

  let cachedSpots: ReturnType<typeof localSpots> | null = null;

  const data = new Uint16Array(width * height * 4);
  const one = DataUtils.toHalfFloat(1);

  const bakeRow = (j: number, spotLocal: ReturnType<typeof localSpots>) => {
    const v = ((j + 0.5) / height) * surface.vLength;
    const ambientScale = ramp[0] + (ramp[1] - ramp[0]) * (v / surface.vLength);
    for (let i = 0; i < width; i++) {
      const u = ((i + 0.5) / width) * surface.uLength;
      const px = origin[0] + uDir[0] * u + vDir[0] * v;
      const py = origin[1] + uDir[1] * u + vDir[1] * v;
      const pz = origin[2] + uDir[2] * u + vDir[2] * v;

      // Occlusion of the soft, undirected light: room corners and things on the wall.
      let occlusion = 1;
      if (edge > 0) {
        const du = Math.min(u, surface.uLength - u);
        const dv = Math.min(v, surface.vLength - v);
        occlusion *=
          (1 - edge * Math.exp(-du / 0.45)) * (1 - edge * Math.exp(-dv / 0.45));
      }
      // Whatever sits on top of this texel covers it, so it never shades it: the
      // label card reuses these texels as its own face.
      let covering: BakeOccluder | null = null;
      for (const box of occluders) {
        const d = boxDistance(u, v, box);
        if (d <= 0) covering = box;
        else if (d < 0.5) {
          occlusion *= 1 - 0.5 * Math.exp(-d / (0.025 + box.depth * 0.9));
        }
      }

      let r = lighting.ambient[0] * ambientScale * occlusion;
      let g = lighting.ambient[1] * ambientScale * occlusion;
      let b = lighting.ambient[2] * ambientScale * occlusion;

      for (let s = 0; s < lighting.spots.length; s++) {
        const spot = lighting.spots[s];
        const lx = spot.position[0] - px;
        const ly = spot.position[1] - py;
        const lz = spot.position[2] - pz;
        const distSq = lx * lx + ly * ly + lz * lz;
        const dist = Math.sqrt(distSq);
        const cosIncidence = (lx * nx + ly * ny + lz * nz) / dist;
        if (cosIncidence <= 0) continue;
        const cosAngle =
          -(
            lx * spot.direction[0] +
            ly * spot.direction[1] +
            lz * spot.direction[2]
          ) / dist;
        if (cosAngle <= spot.cosOuter) continue;
        let e =
          (spot.intensity *
            smoothstep(spot.cosOuter, spot.cosInner, cosAngle) *
            cosIncidence) /
          Math.max(distSq, 0.01);
        if (e < 1e-4) continue;

        // Cast shadow: follow the ray toward the lamp up to the occluder's height and
        // see whether it is still over the occluder's footprint.
        const local = spotLocal[s];
        if (local.h > 0.05) {
          for (const box of occluders) {
            if (box === covering) continue;
            const k = box.depth / local.h;
            const qu = u + (local.u - u) * k;
            const qv = v + (local.v - v) * k;
            const d = boxDistance(qu, qv, box);
            const soft = 0.008 + box.depth * 0.22;
            if (d < soft) e *= smoothstep(-soft, soft, d);
          }
        }
        r += e * spot.color[0];
        g += e * spot.color[1];
        b += e * spot.color[2];
      }

      for (const bounce of lighting.bounces) {
        const dx = px - bounce.position[0];
        const dy = py - bounce.position[1];
        const dz = pz - bounce.position[2];
        const distSq = dx * dx + dy * dy + dz * dz;
        const dist = Math.sqrt(distSq) || 1e-6;
        const cosEmit =
          (dx * bounce.normal[0] +
            dy * bounce.normal[1] +
            dz * bounce.normal[2]) /
          dist;
        if (cosEmit <= 0) continue;
        const cosReceive = -(dx * nx + dy * ny + dz * nz) / dist;
        if (cosReceive <= 0) continue;
        const e =
          ((bounce.power * cosEmit * cosReceive) / (distSq + bounce.radiusSq)) *
          occlusion;
        r += e * bounce.color[0];
        g += e * bounce.color[1];
        b += e * bounce.color[2];
      }

      if (options.neutral) {
        const y = 0.2126 * r + 0.7152 * g + 0.0722 * b;
        r = y;
        g = y;
        b = y;
      }

      const o = (j * width + i) * 4;
      data[o] = DataUtils.toHalfFloat(shape(r));
      data[o + 1] = DataUtils.toHalfFloat(shape(g));
      data[o + 2] = DataUtils.toHalfFloat(shape(b));
      data[o + 3] = one;
    }
  };

  const texture = new DataTexture(
    data,
    width,
    height,
    RGBAFormat,
    HalfFloatType,
  );
  texture.magFilter = LinearFilter;
  texture.minFilter = LinearFilter;
  texture.wrapS = ClampToEdgeWrapping;
  texture.wrapT = ClampToEdgeWrapping;
  texture.generateMipmaps = false;

  let row = 0;
  return {
    texture,
    run(outOfTime) {
      cachedSpots ??= localSpots();
      while (row < height) {
        bakeRow(row++, cachedSpots);
        if ((row & 3) === 0 && outOfTime()) return false;
      }
      texture.needsUpdate = true;
      return true;
    },
  };
}
