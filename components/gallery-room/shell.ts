/**
 * The room's shell: three hung walls, the entrance wall with its doorway, the ceiling
 * and the reflective oak floor. All lit by baked lightmaps.
 */
import {
  BoxGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  Vector3,
} from "three";
import type { BufferGeometry, Texture } from "three";
import { irradianceAt } from "./bake";
import type { BakeLighting, BakeOccluder, BakeSurface } from "./bake";
import { createReflectiveFloor } from "./floor";
import type { ReflectiveFloor } from "./floor";
import type { BakeQueue, SceneKit } from "./kit";
import type { WallId } from "./layout";
import { clamp } from "./math";
import { quadGeometry } from "./surfaces";
import {
  createOakTexture,
  createPlasterTexture,
  PLASTER_TILE,
} from "./textures";

/** Wall labels: centre height, and distance from the frame's edge to the label's centre. */
export const PLAQUE_HEIGHT = 1.28;
export const PLAQUE_GAP = 0.26;

const DOOR_HALF_WIDTH = 1.2;
const DOOR_HEIGHT = 2.95;

export interface RoomShell {
  floor: ReflectiveFloor;
  floorMesh: Mesh;
  /** Per wall: a material that shares the wall's lightmap, for the blank labels. */
  plaqueMaterials: Record<WallId, MeshBasicMaterial>;
}

export function buildShell(
  kit: SceneKit,
  bakes: BakeQueue,
  lighting: BakeLighting,
): RoomShell {
  const { scene, surfaces, track } = kit;
  const plaster = track(createPlasterTexture(kit.anisotropy));
  const oak = track(createOakTexture(kit.anisotropy));

  const wallMaterialFor = (lightMap: Texture, color = 0xffffff) => {
    lightMap.channel = 1;
    return track(new MeshBasicMaterial({ map: plaster, lightMap, color }));
  };

  const baseboardMaterial = track(new MeshBasicMaterial({ color: 0x0b0a09 }));
  const addBaseboard = (surface: BakeSurface, u0: number, u1: number) => {
    // A dark recessed shadow gap where wall meets floor, as in most modern galleries.
    const geometry = track(new BoxGeometry(u1 - u0, 0.07, 0.016));
    const mesh = new Mesh(geometry, baseboardMaterial);
    const mid = (u0 + u1) / 2;
    mesh.position.set(
      surface.origin[0] + surface.uDir[0] * mid + surface.normal[0] * 0.008,
      0.035,
      surface.origin[2] + surface.uDir[2] * mid + surface.normal[2] * 0.008,
    );
    mesh.rotation.y = Math.atan2(-surface.uDir[2], surface.uDir[0]);
    scene.add(mesh);
  };

  const plaqueMaterials = {} as Record<WallId, MeshBasicMaterial>;
  for (const wall of ["left", "back", "right"] as const) {
    const surface = surfaces.wall(wall);
    const lightMap = track(
      bakes.lightmap(surface, {
        density: 48,
        occluders: occludersFor(kit, wall),
        ambientRamp: [0.55, 0.9],
        edgeOcclusion: 0.3,
      }),
    );
    const geometry = track(
      quadGeometry(
        surface,
        0,
        surface.uLength,
        0,
        surface.vLength,
        PLASTER_TILE,
      ),
    );
    scene.add(new Mesh(geometry, wallMaterialFor(lightMap)));
    addBaseboard(surface, 0, surface.uLength);
    plaqueMaterials[wall] = track(
      new MeshBasicMaterial({ lightMap, color: new Color(0.93, 0.93, 0.9) }),
    );
  }

  buildEntrance(kit, bakes, lighting, wallMaterialFor, addBaseboard);

  // Ceiling: a little darker than the walls so the room closes in above the picture lights,
  // but still read as plaster rather than a black void.
  {
    const ceiling = surfaces.ceiling;
    const lightMap = track(
      bakes.lightmap(ceiling, {
        density: 14,
        ambientRamp: [0.7, 0.7],
        edgeOcclusion: 0.25,
      }),
    );
    const geometry = track(
      quadGeometry(
        ceiling,
        0,
        ceiling.uLength,
        0,
        ceiling.vLength,
        PLASTER_TILE,
      ),
    );
    scene.add(new Mesh(geometry, wallMaterialFor(lightMap, 0x9a948c)));
  }

  const floorSurface = surfaces.floor;
  const floorLightMap = track(
    bakes.lightmap(floorSurface, {
      density: 22,
      ambientRamp: [0.8, 0.8],
      edgeOcclusion: 0.35,
    }),
  );
  const floor = track(createReflectiveFloor(kit.renderer, oak, floorLightMap));
  const floorMesh = new Mesh(
    track(
      quadGeometry(
        floorSurface,
        0,
        floorSurface.uLength,
        0,
        floorSurface.vLength,
        null,
      ),
    ),
    floor.material,
  );
  scene.add(floorMesh);

  return { floor, floorMesh, plaqueMaterials };
}

/** Frames and labels on a wall cast soft contact shadows into its lightmap. */
function occludersFor(kit: SceneKit, wall: WallId): BakeOccluder[] {
  const surface = kit.surfaces.wall(wall);
  const boxes: BakeOccluder[] = [];
  for (const p of kit.layout.placements) {
    if (p.wall !== wall) continue;
    const u = p.along + surface.uLength / 2;
    boxes.push({
      u,
      v: p.centre[1],
      halfU: p.outerWidth / 2,
      halfV: p.outerHeight / 2,
      depth: p.depth,
    });
    boxes.push({
      u: u + p.outerWidth / 2 + PLAQUE_GAP,
      v: PLAQUE_HEIGHT,
      halfU: 0.075,
      halfV: 0.05,
      depth: 0.006,
    });
  }
  return boxes;
}

/** Entrance wall, with a doorway through to a darker room beyond. */
function buildEntrance(
  kit: SceneKit,
  bakes: BakeQueue,
  lighting: BakeLighting,
  wallMaterialFor: (lightMap: Texture) => MeshBasicMaterial,
  addBaseboard: (surface: BakeSurface, u0: number, u1: number) => void,
) {
  const { scene, layout, surfaces, track } = kit;
  const surface = surfaces.wall("front");
  const lightMap = track(
    bakes.lightmap(surface, {
      density: 28,
      ambientRamp: [0.55, 0.9],
      edgeOcclusion: 0.3,
    }),
  );
  const material = wallMaterialFor(lightMap);
  const mid = surface.uLength / 2;
  const pieces: Array<[number, number, number, number]> = [
    [0, mid - DOOR_HALF_WIDTH, 0, surface.vLength],
    [mid + DOOR_HALF_WIDTH, surface.uLength, 0, surface.vLength],
    [
      mid - DOOR_HALF_WIDTH,
      mid + DOOR_HALF_WIDTH,
      DOOR_HEIGHT,
      surface.vLength,
    ],
  ];
  for (const [u0, u1, v0, v1] of pieces) {
    scene.add(
      new Mesh(
        track(quadGeometry(surface, u0, u1, v0, v1, PLASTER_TILE)),
        material,
      ),
    );
  }
  addBaseboard(surface, 0, mid - DOOR_HALF_WIDTH);
  addBaseboard(surface, mid + DOOR_HALF_WIDTH, surface.uLength);

  // The doorway's depth (wall thickness) and the next room behind it. Neither is in the bake:
  // both are shaded from the light that reaches the doorway, falling off into the dark.
  const z = layout.depth / 2;
  const light = irradianceAt([0, 1.6, z - 0.05], [0, 0, -1], lighting);
  const spill = new Color(
    (0.8 * light[0] * 0.5) / Math.PI,
    (0.76 * light[1] * 0.5) / Math.PI,
    (0.68 * light[2] * 0.5) / Math.PI,
  );
  const shaded = track(
    new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }),
  );
  const addShaded = (
    geometry: BufferGeometry,
    shade: (p: Vector3) => number,
    tint = spill,
  ) => {
    paintVertices(geometry, (p, out) =>
      out.copy(tint).multiplyScalar(shade(p)),
    );
    scene.add(new Mesh(track(geometry), shaded));
  };

  // Jambs and soffit: lit like the wall at the room side, dimmer towards the next room.
  const depthShade = (p: Vector3) =>
    0.95 - 0.4 * clamp((p.z - z) / REVEAL_DEPTH, 0, 1);
  for (const sign of [-1, 1]) {
    const jamb = new PlaneGeometry(REVEAL_DEPTH, DOOR_HEIGHT, 4, 1);
    jamb.rotateY((sign * Math.PI) / 2);
    jamb.translate(
      sign * DOOR_HALF_WIDTH,
      DOOR_HEIGHT / 2,
      z + REVEAL_DEPTH / 2,
    );
    addShaded(jamb, depthShade);
  }
  const soffit = new PlaneGeometry(DOOR_HALF_WIDTH * 2, REVEAL_DEPTH, 1, 4);
  soffit.rotateX(Math.PI / 2);
  soffit.translate(0, DOOR_HEIGHT, z + REVEAL_DEPTH / 2);
  addShaded(soffit, (p) => 0.72 * depthShade(p));

  // A slim dark casing around the opening gives the corner between wall and jamb a clean line.
  const casing = track(new MeshBasicMaterial({ color: 0x15120f }));
  const trim = (width: number, height: number, x: number, y: number) => {
    const mesh = new Mesh(
      track(new BoxGeometry(width, height, CASING_PROUD)),
      casing,
    );
    mesh.position.set(x, y, z - CASING_PROUD / 2);
    scene.add(mesh);
  };
  for (const sign of [-1, 1]) {
    trim(
      CASING_WIDTH,
      DOOR_HEIGHT + CASING_WIDTH,
      sign * (DOOR_HALF_WIDTH + CASING_WIDTH / 2),
      (DOOR_HEIGHT + CASING_WIDTH) / 2,
    );
  }
  trim(DOOR_HALF_WIDTH * 2, CASING_WIDTH, 0, DOOR_HEIGHT + CASING_WIDTH / 2);

  // The next room: a closed gallery with its lights turned low. Light from this room carries
  // a little way through the door; one dim picture light shows a work on the far wall.
  const near = z + REVEAL_DEPTH;
  const far = near + NEXT_ROOM_DEPTH;
  const halfWidth = NEXT_ROOM_WIDTH / 2;
  const height = layout.height;
  const fade = (p: Vector3) =>
    0.22 + 0.78 * Math.exp(-Math.max(0, p.z - z) / 2.4);
  const segments = 12;

  // The floor starts under the jambs, so the threshold is covered too.
  const floor = new PlaneGeometry(NEXT_ROOM_WIDTH, far - z, 4, segments);
  floor.rotateX(-Math.PI / 2);
  floor.translate(0, -0.002, (z + far) / 2);
  // Brightest in the pool of light that falls through the doorway.
  addShaded(
    floor,
    (p) => (0.5 + 0.5 * Math.exp(-((p.x / 1.6) ** 2))) * 0.42 * fade(p),
    FLOOR_TINT,
  );

  const ceiling = new PlaneGeometry(
    NEXT_ROOM_WIDTH,
    NEXT_ROOM_DEPTH,
    1,
    segments,
  );
  ceiling.rotateX(Math.PI / 2);
  ceiling.translate(0, height, (near + far) / 2);
  addShaded(ceiling, (p) => 0.4 * fade(p));

  for (const sign of [-1, 1]) {
    const wall = new PlaneGeometry(NEXT_ROOM_DEPTH, height, segments, 4);
    wall.rotateY((sign * Math.PI) / 2);
    wall.translate(sign * halfWidth, height / 2, (near + far) / 2);
    // A touch brighter low down, where the light through the door lands.
    addShaded(wall, (p) => 0.75 * fade(p) * (1 - 0.3 * (p.y / height)));
  }

  // The far wall, with a soft oval of light around the work hung there.
  const workY = 1.55;
  const farWall = new PlaneGeometry(NEXT_ROOM_WIDTH, height, 24, 16);
  farWall.translate(0, height / 2, far);
  addShaded(farWall, (p) => {
    const glow = Math.exp(
      -((p.x / 1.05) ** 2) - ((p.y - workY - 0.15) / 1.1) ** 2,
    );
    return 0.75 * fade(p) + 1.1 * glow;
  });
  const work = new Mesh(
    track(new BoxGeometry(0.95, 0.72, 0.04)),
    track(new MeshBasicMaterial({ color: 0x17130f })),
  );
  work.position.set(0, workY, far - 0.03);
  const canvas = new Mesh(
    track(new PlaneGeometry(0.81, 0.58)),
    track(
      new MeshBasicMaterial({
        color: new Color(spill)
          .multiplyScalar(0.55)
          .lerp(new Color(0.05, 0.035, 0.02), 0.5),
      }),
    ),
  );
  canvas.position.set(0, workY, far - 0.06);
  canvas.rotation.y = Math.PI;
  scene.add(work, canvas);

  // The other side of the entrance wall, seen only at a slant through the doorway.
  for (const sign of [-1, 1]) {
    const back = new PlaneGeometry(halfWidth - DOOR_HALF_WIDTH, height, 1, 1);
    back.translate(
      (sign * (DOOR_HALF_WIDTH + halfWidth)) / 2,
      height / 2,
      near,
    );
    addShaded(back, () => 0.2);
  }
  const lintel = new PlaneGeometry(
    DOOR_HALF_WIDTH * 2,
    height - DOOR_HEIGHT,
    1,
    1,
  );
  lintel.translate(0, (height + DOOR_HEIGHT) / 2, near);
  addShaded(lintel, () => 0.2);
}

const REVEAL_DEPTH = 0.42;
const CASING_WIDTH = 0.05;
const CASING_PROUD = 0.012;
const NEXT_ROOM_WIDTH = 6.5;
const NEXT_ROOM_DEPTH = 7;
/** Oak, unlit: the next room's floor reads as the same boards in shadow. */
const FLOOR_TINT = new Color(0.16, 0.1, 0.06);

/** Writes a per-vertex colour from each vertex's position. */
function paintVertices(
  geometry: BufferGeometry,
  colorAt: (position: Vector3, out: Color) => Color,
) {
  const positions = geometry.getAttribute("position");
  const colors = new Float32Array(positions.count * 3);
  const p = new Vector3();
  const c = new Color();
  for (let i = 0; i < positions.count; i++) {
    p.fromBufferAttribute(positions, i);
    colorAt(p, c);
    colors[i * 3] = c.r;
    colors[i * 3 + 1] = c.g;
    colors[i * 3 + 2] = c.b;
  }
  geometry.setAttribute("color", new Float32BufferAttribute(colors, 3));
}
