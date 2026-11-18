/**
 * Picture lights: the baked spots and bounce light for every work, one realtime lamp
 * per work for the frames and fittings, and the track hardware the lamps hang from.
 */
import {
  BoxGeometry,
  CircleGeometry,
  Color,
  CylinderGeometry,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  SpotLight,
  Vector3,
} from "three";
import { irradianceAt } from "./bake";
import type { BakeBounce, BakeLighting, BakeSpot } from "./bake";
import type { SceneKit } from "./kit";
import type { Vec3, WallId } from "./layout";
import { add3, clamp, DEG, normalize3 } from "./math";

/** Irradiance a picture light delivers to the middle of its picture. */
export const PICTURE_IRRADIANCE = Math.PI;
const LIGHT_COLOR: Vec3 = [1, 0.905, 0.76];
const AMBIENT: Vec3 = [
  PICTURE_IRRADIANCE * 0.03,
  PICTURE_IRRADIANCE * 0.0285,
  PICTURE_IRRADIANCE * 0.026,
];
const BOUNCE_COLOR: Vec3 = [1, 0.9, 0.76];

interface Fixture {
  position: Vec3;
  direction: Vec3;
}

/**
 * Plans every picture light, adds the realtime lamps and the track hardware to the
 * scene, and returns the lighting the lightmaps are baked from.
 */
export function lightPictures(kit: SceneKit): BakeLighting {
  const { scene, layout, track } = kit;
  const lampHeight = layout.height - 0.32;
  const lighting: BakeLighting = { spots: [], bounces: [], ambient: AMBIENT };
  const fixtures: Fixture[] = [];
  const trackOffsets: Record<WallId, number[]> = {
    left: [],
    back: [],
    right: [],
  };

  for (const p of layout.placements) {
    // The classic 30° rule: lamps sit out from the wall by tan 30° of their height
    // above the picture, which keeps glare off the varnish.
    const offset = clamp(
      (lampHeight - p.centre[1]) * Math.tan(30 * DEG),
      1,
      1.7,
    );
    trackOffsets[p.wall].push(offset);
    const lampCount = Math.max(1, Math.round(p.outerWidth / 1.3));
    const segment = p.outerWidth / lampCount;
    const aimHeight = p.centre[1] + p.height * 0.05;
    const spots: BakeSpot[] = [];
    for (let k = 0; k < lampCount; k++) {
      const shift = (k - (lampCount - 1) / 2) * segment;
      const onWall = add3(p.centre, p.tangent, shift);
      const position: Vec3 = [
        onWall[0] + p.normal[0] * offset,
        lampHeight,
        onWall[2] + p.normal[2] * offset,
      ];
      const aim: Vec3 = [onWall[0], aimHeight, onWall[2]];
      const toAim: Vec3 = [
        aim[0] - position[0],
        aim[1] - position[1],
        aim[2] - position[2],
      ];
      const range = Math.hypot(toAim[0], toAim[1], toAim[2]);
      const direction = normalize3(toAim);
      const halfExtent =
        0.5 * Math.max(p.outerHeight * (offset / range), segment);
      const outer = clamp(
        Math.atan((halfExtent * 1.12 + 0.34) / range),
        14 * DEG,
        40 * DEG,
      );
      spots.push({
        position,
        direction,
        cosOuter: Math.cos(outer),
        cosInner: Math.cos(outer * 0.14),
        intensity: 1,
        color: LIGHT_COLOR,
      });
      fixtures.push({ position, direction });
    }
    // Trim the group so the middle of the picture receives the design irradiance.
    const probe = irradianceAt(add3(p.centre, p.normal, 0.02), p.normal, {
      spots,
      bounces: [],
      ambient: [0, 0, 0],
    });
    const trim = PICTURE_IRRADIANCE / Math.max(probe[0], 1e-4);
    for (const spot of spots) spot.intensity *= trim;
    lighting.spots.push(...spots);

    const patch = (p.outerWidth + 0.5) * (p.outerHeight + 0.5);
    const bounce: BakeBounce = {
      position: add3(p.centre, p.normal, 0.03),
      normal: p.normal,
      power: (PICTURE_IRRADIANCE * patch * 0.55) / Math.PI,
      radiusSq: Math.pow((p.outerWidth + p.outerHeight) / 4 + 0.3, 2),
      color: BOUNCE_COLOR,
    };
    lighting.bounces.push(bounce);

    // One realtime lamp per work, for the frame and fittings only.
    const lampPosition: Vec3 = [
      p.centre[0] + p.normal[0] * offset,
      lampHeight,
      p.centre[2] + p.normal[2] * offset,
    ];
    const range = Math.hypot(offset, lampHeight - aimHeight);
    const cover =
      0.5 * Math.hypot(p.outerWidth, p.outerHeight * (offset / range));
    const lamp = new SpotLight(
      new Color(LIGHT_COLOR[0], LIGHT_COLOR[1], LIGHT_COLOR[2]),
      (PICTURE_IRRADIANCE * range * range) / (offset / range),
      0,
      clamp(Math.atan((cover * 1.2 + 0.35) / range), 16 * DEG, 52 * DEG),
      0.6,
      2,
    );
    lamp.position.set(lampPosition[0], lampPosition[1], lampPosition[2]);
    lamp.target.position.set(p.centre[0], aimHeight, p.centre[2]);
    scene.add(lamp, lamp.target);
    track(lamp);
  }

  addTrackHardware(kit, fixtures, trackOffsets);
  return lighting;
}

/** Ceiling rails, lamp heads, lenses and stems. Shaded by the realtime lamps. */
function addTrackHardware(
  kit: SceneKit,
  fixtures: Fixture[],
  trackOffsets: Record<WallId, number[]>,
) {
  const { scene, layout, surfaces, track } = kit;
  const roomHeight = layout.height;
  const fittingMaterial = track(
    new MeshStandardMaterial({
      color: 0x1b1917,
      roughness: 0.62,
      metalness: 0.3,
    }),
  );

  const railGeometry = track(new BoxGeometry(1, 0.035, 0.04));
  for (const wall of ["left", "back", "right"] as const) {
    const offsets = trackOffsets[wall];
    if (offsets.length === 0) continue;
    const surface = surfaces.wall(wall);
    const offset = offsets.reduce((sum, o) => sum + o, 0) / offsets.length;
    const rail = new Mesh(railGeometry, fittingMaterial);
    const mid = surface.uLength / 2;
    rail.position.set(
      surface.origin[0] + surface.uDir[0] * mid + surface.normal[0] * offset,
      roomHeight - 0.02,
      surface.origin[2] + surface.uDir[2] * mid + surface.normal[2] * offset,
    );
    rail.scale.x = surface.uLength - 1.6;
    rail.rotation.y = Math.atan2(-surface.uDir[2], surface.uDir[0]);
    scene.add(rail);
  }

  const headGeometry = track(new CylinderGeometry(0.048, 0.042, 0.17, 20));
  const stemGeometry = track(new CylinderGeometry(0.011, 0.011, 1, 8));
  const lensGeometry = track(new CircleGeometry(0.036, 20));
  // The lamp face itself: bright enough to read as the source, small enough not to glare.
  const lensMaterial = track(
    new MeshBasicMaterial({ color: new Color(6, 5.2, 4) }),
  );
  const yAxis = new Vector3(0, 1, 0);
  const zAxis = new Vector3(0, 0, 1);
  for (const fixture of fixtures) {
    const direction = new Vector3(...fixture.direction);
    const head = new Mesh(headGeometry, fittingMaterial);
    head.position.set(...fixture.position).addScaledVector(direction, -0.085);
    head.quaternion.setFromUnitVectors(yAxis, direction.clone().negate());
    const lens = new Mesh(lensGeometry, lensMaterial);
    lens.position.set(...fixture.position).addScaledVector(direction, 0.002);
    lens.quaternion.setFromUnitVectors(zAxis, direction);
    const stem = new Mesh(stemGeometry, fittingMaterial);
    const stemLength = roomHeight - 0.04 - head.position.y;
    stem.scale.y = stemLength;
    stem.position.set(
      head.position.x,
      head.position.y + stemLength / 2,
      head.position.z,
    );
    scene.add(head, lens, stem);
  }
}
