/**
 * Pure layout maths for the gallery room: physical sizes parsed from the AIC
 * dimensions string, and where each work hangs. No three.js in here.
 */
import type { RoomArtwork } from "./types";

/** All lengths are metres. */
export const WALL_HEIGHT = 3.5;
export const EYE_HEIGHT = 1.6;
/** Museum hanging height: the centre of the picture, in metres above the floor. */
export const HANG_CENTRE = 1.5;
export const MAX_WORKS = 8;

const MIN_ROOM_WIDTH = 9;
const MIN_ROOM_DEPTH = 8;

export type WallId = "left" | "back" | "right";
export type Vec3 = readonly [number, number, number];

export interface WorkSize {
  /** Picture size in metres (without the frame). */
  width: number;
  height: number;
  /** Width of the frame moulding and how far it stands off the wall, in metres. */
  moulding: number;
  depth: number;
  /** True when width/height come from the dimensions string, not a guess. */
  measured: boolean;
}

export interface Placement extends WorkSize {
  index: number;
  wall: WallId;
  /** Position along the wall, measured from the wall's centre toward the viewer's right. */
  along: number;
  /** Centre of the picture on the wall surface (world space). */
  centre: Vec3;
  /** Wall normal, pointing into the room. */
  normal: Vec3;
  /** The viewer's right when facing the wall. */
  tangent: Vec3;
  outerWidth: number;
  outerHeight: number;
}

export interface RoomLayout {
  width: number;
  depth: number;
  height: number;
  placements: Placement[];
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

const NUMBER = String.raw`(\d+(?:[.,]\d+)?)`;
const CM_PATTERN = new RegExp(
  String.raw`${NUMBER}\s*[×xX]\s*${NUMBER}(?:\s*[×xX]\s*${NUMBER})?\s*cm`,
);

function parseCm(part: string): [number, number, number | null] | null {
  const match = CM_PATTERN.exec(part);
  if (!match) return null;
  const toNumber = (s: string) => Number.parseFloat(s.replace(",", "."));
  const h = toNumber(match[1]);
  const w = toNumber(match[2]);
  const d = match[3] ? toNumber(match[3]) : null;
  if (!(h > 0) || !(w > 0)) return null;
  return [h, w, d];
}

/**
 * Reads the first "H × W cm" pair as the size of the work, and a "Framed: H × W × D cm"
 * part (when there is one) as the real frame. The picture plane always keeps the image's
 * aspect ratio so the texture is never stretched; the parsed numbers set the scale.
 */
export function measureWork(
  dimensions: string | null,
  aspectRatio: number,
): WorkSize {
  const aspect =
    Number.isFinite(aspectRatio) && aspectRatio > 0
      ? clamp(aspectRatio, 0.2, 5)
      : 0.8;

  let work: [number, number, number | null] | null = null;
  let framed: [number, number, number | null] | null = null;
  for (const part of (dimensions ?? "").split(";")) {
    const isFrame = /fram/i.test(part);
    const parsed = parseCm(part);
    if (!parsed) continue;
    if (isFrame) framed ??= parsed;
    else work ??= parsed;
  }

  let width: number;
  let height: number;
  let measured = false;
  if (work) {
    const areaM2 = (work[0] / 100) * (work[1] / 100);
    const dataAspect = work[1] / work[0];
    const mismatch = Math.max(dataAspect / aspect, aspect / dataAspect);
    if (mismatch < 1.6) {
      height = Math.sqrt(areaM2 / aspect);
      width = height * aspect;
      measured = true;
    } else {
      // The numbers describe something else (a sheet, a base, a swapped pair).
      height = Math.max(work[0], work[1]) / 100 / Math.max(1, aspect);
      width = height * aspect;
    }
  } else {
    height = 0.8;
    width = height * aspect;
    if (width > 1.4) {
      width = 1.4;
      height = width / aspect;
    }
  }

  // Keep everything hangable under a 3.5 m ceiling, with room for the lamps.
  const scale = Math.min(1, 2.3 / height, 3.8 / width);
  width *= scale;
  height *= scale;
  const grow = Math.max(1, 0.2 / Math.max(width, height));
  width *= grow;
  height *= grow;

  const largest = Math.max(width, height);
  let moulding = clamp(0.026 + 0.03 * Math.sqrt(largest), 0.03, 0.085);
  let depth = clamp(moulding * 0.62, 0.03, 0.06);
  if (work && framed && measured) {
    const extra = (framed[0] - work[0] + (framed[1] - work[1])) / 4 / 100;
    // Museum frames on these works are broad; keep their relative weight but slim
    // them, so the frame never competes with the picture at hero size.
    if (extra > 0.01) moulding = clamp(extra * scale * 0.72, 0.03, 0.085);
    if (framed[2]) depth = clamp((framed[2] / 100) * scale * 0.7, 0.03, 0.06);
  }

  return { width, height, moulding, depth, measured };
}

function minGap(a: number, b: number): number {
  return Math.max(0.85, 0.7 + 0.11 * (a + b));
}

function endMargin(outerWidth: number): number {
  return 1.15 + 0.15 * outerWidth;
}

function requiredLength(widths: number[]): number {
  if (widths.length === 0) return 0;
  let total = endMargin(widths[0]) + endMargin(widths[widths.length - 1]);
  for (let i = 0; i < widths.length; i++) {
    total += widths[i];
    if (i > 0) total += minGap(widths[i - 1], widths[i]);
  }
  return total;
}

/** Centres of the works along one wall, measured from the wall's centre. */
function spread(widths: number[], wallLength: number): number[] {
  const count = widths.length;
  if (count === 0) return [];
  const gaps: number[] = [];
  for (let i = 1; i < count; i++) gaps.push(minGap(widths[i - 1], widths[i]));
  const occupied =
    widths.reduce((sum, w) => sum + w, 0) + gaps.reduce((sum, g) => sum + g, 0);
  const startMargin = endMargin(widths[0]);
  const finishMargin = endMargin(widths[count - 1]);
  const free = Math.max(0, wallLength - occupied - startMargin - finishMargin);
  // Share spare wall between the gaps and the two ends, but keep the hang reading as
  // one group: a gap never opens by more than 1.5 m.
  const perGap = count > 1 ? Math.min(1.5, free / (count - 1 + 2.4)) : 0;
  const group = occupied + perGap * (count - 1);
  let cursor = -group / 2;
  const centres: number[] = [];
  for (let i = 0; i < count; i++) {
    centres.push(cursor + widths[i] / 2);
    cursor += widths[i] + (i < count - 1 ? gaps[i] + perGap : 0);
  }
  return centres;
}

/**
 * Hangs the works clockwise round three walls of a rectangular room, in index order:
 * left wall (entrance end → far end), then the far wall (left → right), then the right
 * wall (far end → entrance end). "Next" is therefore always a step to the viewer's right.
 *
 * Every way of cutting the sequence into those three runs is scored and the most
 * compact, most even room wins.
 */
export function layoutRoom(artworks: readonly RoomArtwork[]): RoomLayout {
  const works = artworks.slice(0, MAX_WORKS);
  const sizes = works.map((w) => measureWork(w.dimensions, w.aspectRatio));
  const outer = sizes.map((s) => s.width + s.moulding * 2);
  const n = works.length;

  let best = { left: 0, right: 0, cost: Number.POSITIVE_INFINITY };
  const needSides = n >= 3 ? 1 : 0;
  for (let left = needSides; left <= n - 1; left++) {
    for (let right = needSides; right <= n - 1 - left; right++) {
      const back = n - left - right;
      if (back < 1) continue;
      const leftLen = requiredLength(outer.slice(0, left));
      const backLen = requiredLength(outer.slice(left, left + back));
      const rightLen = requiredLength(outer.slice(left + back));
      const width = Math.max(MIN_ROOM_WIDTH, backLen);
      const depth = Math.max(MIN_ROOM_DEPTH, leftLen, rightLen);
      const ratio = Math.max(width, depth) / Math.min(width, depth);
      const cost =
        width * depth +
        3 * Math.abs(leftLen - rightLen) +
        14 * Math.max(0, ratio - 1.45);
      if (cost < best.cost) best = { left, right, cost };
    }
  }

  const backCount = n - best.left - best.right;
  const groups: Record<WallId, number[]> = {
    left: [],
    back: [],
    right: [],
  };
  for (let i = 0; i < n; i++) {
    if (i < best.left) groups.left.push(i);
    else if (i < best.left + backCount) groups.back.push(i);
    else groups.right.push(i);
  }

  const widthsOf = (ids: number[]) => ids.map((i) => outer[i]);
  const width = Math.max(MIN_ROOM_WIDTH, requiredLength(widthsOf(groups.back)));
  const depth = Math.max(
    MIN_ROOM_DEPTH,
    requiredLength(widthsOf(groups.left)),
    requiredLength(widthsOf(groups.right)),
  );

  const walls: Record<
    WallId,
    { length: number; normal: Vec3; tangent: Vec3; origin: Vec3 }
  > = {
    left: {
      length: depth,
      normal: [1, 0, 0],
      tangent: [0, 0, -1],
      origin: [-width / 2, 0, 0],
    },
    back: {
      length: width,
      normal: [0, 0, 1],
      tangent: [1, 0, 0],
      origin: [0, 0, -depth / 2],
    },
    right: {
      length: depth,
      normal: [-1, 0, 0],
      tangent: [0, 0, 1],
      origin: [width / 2, 0, 0],
    },
  };

  const placements: Placement[] = [];
  for (const wallId of ["left", "back", "right"] as const) {
    const ids = groups[wallId];
    const wall = walls[wallId];
    const centres = spread(widthsOf(ids), wall.length);
    ids.forEach((index, k) => {
      const size = sizes[index];
      const outerHeight = size.height + size.moulding * 2;
      // Hang on the centre line unless that would push a tall work into the floor.
      const y = Math.max(HANG_CENTRE, outerHeight / 2 + 0.28);
      const along = centres[k];
      placements[index] = {
        ...size,
        index,
        wall: wallId,
        along,
        centre: [
          wall.origin[0] + wall.tangent[0] * along,
          y,
          wall.origin[2] + wall.tangent[2] * along,
        ],
        normal: wall.normal,
        tangent: wall.tangent,
        outerWidth: outer[index],
        outerHeight,
      };
    });
  }

  return { width, depth, height: WALL_HEIGHT, placements };
}
