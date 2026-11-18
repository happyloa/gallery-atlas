/**
 * The room's flat surfaces (walls, floor, ceiling) as baked-surface descriptions, and the
 * quad geometry cut from them.
 */
import { BufferGeometry, Float32BufferAttribute } from "three";
import type { BakeSurface } from "./bake";
import type { RoomLayout, Vec3, WallId } from "./layout";

export type SurfaceWall = WallId | "front";

export interface RoomSurfaces {
  wall(wall: SurfaceWall): BakeSurface;
  floor: BakeSurface;
  ceiling: BakeSurface;
}

const UP: Vec3 = [0, 1, 0];

export function createRoomSurfaces(layout: RoomLayout): RoomSurfaces {
  const { width, depth, height } = layout;

  const wall = (id: SurfaceWall): BakeSurface => {
    switch (id) {
      case "left":
        return {
          origin: [-width / 2, 0, depth / 2],
          uDir: [0, 0, -1],
          vDir: UP,
          normal: [1, 0, 0],
          uLength: depth,
          vLength: height,
        };
      case "back":
        return {
          origin: [-width / 2, 0, -depth / 2],
          uDir: [1, 0, 0],
          vDir: UP,
          normal: [0, 0, 1],
          uLength: width,
          vLength: height,
        };
      case "right":
        return {
          origin: [width / 2, 0, -depth / 2],
          uDir: [0, 0, 1],
          vDir: UP,
          normal: [-1, 0, 0],
          uLength: depth,
          vLength: height,
        };
      case "front":
        return {
          origin: [width / 2, 0, depth / 2],
          uDir: [-1, 0, 0],
          vDir: UP,
          normal: [0, 0, -1],
          uLength: width,
          vLength: height,
        };
    }
  };

  return {
    wall,
    floor: {
      origin: [-width / 2, 0, depth / 2],
      uDir: [1, 0, 0],
      vDir: [0, 0, -1],
      normal: [0, 1, 0],
      uLength: width,
      vLength: depth,
    },
    ceiling: {
      origin: [-width / 2, height, -depth / 2],
      uDir: [1, 0, 0],
      vDir: [0, 0, 1],
      normal: [0, -1, 0],
      uLength: width,
      vLength: depth,
    },
  };
}

/** A rectangle cut from a baked surface. uv tiles the albedo, uv1 addresses the lightmap. */
export function quadGeometry(
  surface: BakeSurface,
  u0: number,
  u1: number,
  v0: number,
  v1: number,
  tile: number | null,
): BufferGeometry {
  const corners: Array<[number, number]> = [
    [u0, v0],
    [u1, v0],
    [u1, v1],
    [u0, v1],
  ];
  const positions: number[] = [];
  const normals: number[] = [];
  const uvs: number[] = [];
  const lightUvs: number[] = [];
  for (const [u, v] of corners) {
    positions.push(
      surface.origin[0] + surface.uDir[0] * u + surface.vDir[0] * v,
      surface.origin[1] + surface.uDir[1] * u + surface.vDir[1] * v,
      surface.origin[2] + surface.uDir[2] * u + surface.vDir[2] * v,
    );
    normals.push(...surface.normal);
    const lu = u / surface.uLength;
    const lv = v / surface.vLength;
    lightUvs.push(lu, lv);
    if (tile === null) uvs.push(lu, lv);
    else uvs.push(u / tile, v / tile);
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new Float32BufferAttribute(normals, 3));
  geometry.setAttribute("uv", new Float32BufferAttribute(uvs, 2));
  geometry.setAttribute("uv1", new Float32BufferAttribute(lightUvs, 2));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  return geometry;
}
