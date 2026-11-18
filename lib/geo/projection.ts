/**
 * The map's projection: plain equirectangular, cropped to the inhabited latitudes.
 * scripts/build-world-map.mjs uses the same numbers to draw the land outline.
 */
export const MAP_WIDTH = 1000;
const NORTH = 84;
const SOUTH = -58;
export const MAP_HEIGHT = Math.round((MAP_WIDTH * (NORTH - SOUTH)) / 360);

export function project(lat: number, lon: number): { x: number; y: number } {
  return {
    x: ((lon + 180) / 360) * MAP_WIDTH,
    y: ((NORTH - lat) / (NORTH - SOUTH)) * MAP_HEIGHT,
  };
}
