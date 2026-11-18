/**
 * Picture frames: a moulding profile swept round the picture with mitred corners.
 * Four styles (two gilt, two dark wood), picked per work so that no two neighbours match.
 */
import {
  BufferGeometry,
  Float32BufferAttribute,
  MeshStandardMaterial,
} from "three";

export type FrameStyle = "gilt-scoop" | "walnut" | "ebony" | "gilt-cushion";

export const FRAME_STYLES: readonly FrameStyle[] = [
  "gilt-scoop",
  "walnut",
  "gilt-cushion",
  "ebony",
];

/**
 * Profiles are polylines of [u, v]: u runs from the sight edge (0) to the outer edge (1)
 * across the moulding; v is the height off the wall (0..1 of the frame depth). The
 * picture sits at REBATE, tucked just under the sight edge.
 */
export const REBATE = 0.42;

const PROFILES: Record<FrameStyle, ReadonlyArray<readonly [number, number]>> = {
  "gilt-scoop": [
    [0, REBATE],
    [0, 0.58],
    [0.1, 0.64],
    [0.2, 0.54],
    [0.55, 0.66],
    [0.8, 0.94],
    [0.92, 1],
    [1, 0.9],
    [1, 0],
  ],
  walnut: [
    [0, REBATE],
    [0, 0.8],
    [0.1, 0.87],
    [0.84, 1],
    [1, 0.93],
    [1, 0],
  ],
  ebony: [
    [0, REBATE],
    [0, 0.9],
    [0.12, 1],
    [0.3, 1],
    [0.9, 0.62],
    [1, 0.56],
    [1, 0],
  ],
  "gilt-cushion": [
    [0, REBATE],
    [0, 0.62],
    [0.1, 0.76],
    [0.3, 0.93],
    [0.5, 1],
    [0.7, 0.93],
    [0.9, 0.76],
    [1, 0.56],
    [1, 0],
  ],
};

/** Highest point of the profile above the picture plane, as a fraction of depth. */
export function lipHeight(style: FrameStyle): number {
  return PROFILES[style][1][1] - REBATE;
}

/**
 * The frame is built in its own space: x right, y up, z out of the wall, centred on the
 * picture. Faces are left unshared so every facet of the moulding shades flat and crisp.
 */
export function createFrameGeometry(
  innerWidth: number,
  innerHeight: number,
  moulding: number,
  depth: number,
  style: FrameStyle,
): BufferGeometry {
  const profile = PROFILES[style];
  const corners: ReadonlyArray<readonly [number, number]> = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ];
  const positions: number[] = [];
  const point = (corner: readonly [number, number], k: number) => {
    const [u, v] = profile[k];
    return [
      corner[0] * (innerWidth / 2 + u * moulding),
      corner[1] * (innerHeight / 2 + u * moulding),
      v * depth,
    ] as const;
  };
  for (let side = 0; side < 4; side++) {
    const a = corners[side];
    const b = corners[(side + 1) % 4];
    for (let k = 0; k < profile.length - 1; k++) {
      const a0 = point(a, k);
      const a1 = point(a, k + 1);
      const b0 = point(b, k);
      const b1 = point(b, k + 1);
      positions.push(...a0, ...a1, ...b1, ...a0, ...b1, ...b0);
    }
  }
  const geometry = new BufferGeometry();
  geometry.setAttribute("position", new Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

export function createFrameMaterial(style: FrameStyle): MeshStandardMaterial {
  switch (style) {
    case "gilt-scoop":
      // Old water gilding: warm, worn, never mirror-bright.
      return new MeshStandardMaterial({
        color: 0xa28350,
        metalness: 0.85,
        roughness: 0.46,
      });
    case "gilt-cushion":
      return new MeshStandardMaterial({
        color: 0x7d6238,
        metalness: 0.8,
        roughness: 0.56,
      });
    case "walnut":
      return new MeshStandardMaterial({
        color: 0x4a3020,
        metalness: 0,
        roughness: 0.52,
      });
    case "ebony":
      return new MeshStandardMaterial({
        color: 0x161413,
        metalness: 0,
        roughness: 0.36,
      });
  }
}
