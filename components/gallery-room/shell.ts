/**
 * The room's shell: three hung walls, the entrance wall with its doorway, the ceiling
 * and the reflective oak floor. All lit by baked lightmaps.
 */
import {
  BoxGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
} from "three";
import type { Texture } from "three";
import { irradianceAt } from "./bake";
import type { BakeLighting, BakeOccluder, BakeSurface } from "./bake";
import { createReflectiveFloor } from "./floor";
import type { ReflectiveFloor } from "./floor";
import type { BakeQueue, SceneKit } from "./kit";
import type { WallId } from "./layout";
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

  // Ceiling: darker than the walls so the room closes in above the picture lights.
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
    scene.add(new Mesh(geometry, wallMaterialFor(lightMap, 0x5c5650)));
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

  // Door reveal and the next room: unlit plaster and floor fading into the dark.
  const revealDepth = 0.42;
  const z = layout.depth / 2;
  const revealLight = irradianceAt([0, 1.6, z - 0.05], [0, 0, -1], lighting);
  const reveal = track(
    new MeshBasicMaterial({
      color: new Color(
        (0.8 * revealLight[0] * 0.5) / Math.PI,
        (0.76 * revealLight[1] * 0.5) / Math.PI,
        (0.68 * revealLight[2] * 0.5) / Math.PI,
      ),
    }),
  );
  const side = track(new PlaneGeometry(revealDepth, DOOR_HEIGHT));
  const leftReveal = new Mesh(side, reveal);
  leftReveal.position.set(
    -DOOR_HALF_WIDTH,
    DOOR_HEIGHT / 2,
    z + revealDepth / 2,
  );
  leftReveal.rotation.y = Math.PI / 2;
  const rightReveal = new Mesh(side, reveal);
  rightReveal.position.set(
    DOOR_HALF_WIDTH,
    DOOR_HEIGHT / 2,
    z + revealDepth / 2,
  );
  rightReveal.rotation.y = -Math.PI / 2;
  const soffit = new Mesh(
    track(new PlaneGeometry(DOOR_HALF_WIDTH * 2, revealDepth)),
    reveal,
  );
  soffit.position.set(0, DOOR_HEIGHT, z + revealDepth / 2);
  soffit.rotation.x = Math.PI / 2;
  scene.add(leftReveal, rightReveal, soffit);

  const beyondFloor = new Mesh(
    track(new PlaneGeometry(9, 7)),
    track(new MeshBasicMaterial({ color: 0x0a0806 })),
  );
  beyondFloor.rotation.x = -Math.PI / 2;
  beyondFloor.position.set(0, -0.002, z + 3.5);
  const beyondWall = new Mesh(
    track(new PlaneGeometry(9, layout.height)),
    track(new MeshBasicMaterial({ color: 0x1a1612 })),
  );
  beyondWall.position.set(0, layout.height / 2, z + 7);
  beyondWall.rotation.y = Math.PI;
  scene.add(beyondFloor, beyondWall);
}
