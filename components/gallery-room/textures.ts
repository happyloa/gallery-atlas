/**
 * Procedural surface textures, drawn once into 2D canvases: plaster, oak boards and
 * the primed-linen placeholder. Nothing here is downloaded, and every texture tiles.
 */
import {
  CanvasTexture,
  LinearFilter,
  LinearMipmapLinearFilter,
  RepeatWrapping,
  SRGBColorSpace,
} from "three";

/** Small deterministic PRNG so the room looks the same on every visit. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Value noise that wraps at the edges, so the texture tiles without a seam. */
function tileableNoise(
  size: number,
  cells: number,
  seed: number,
): Float32Array {
  const random = mulberry32(seed);
  const lattice = new Float32Array(cells * cells);
  for (let i = 0; i < lattice.length; i++) lattice[i] = random();
  const out = new Float32Array(size * size);
  const smooth = (t: number) => t * t * (3 - 2 * t);
  for (let y = 0; y < size; y++) {
    const fy = (y / size) * cells;
    const y0 = Math.floor(fy);
    const ty = smooth(fy - y0);
    const y1 = (y0 + 1) % cells;
    for (let x = 0; x < size; x++) {
      const fx = (x / size) * cells;
      const x0 = Math.floor(fx);
      const tx = smooth(fx - x0);
      const x1 = (x0 + 1) % cells;
      const a = lattice[y0 * cells + x0];
      const b = lattice[y0 * cells + x1];
      const c = lattice[y1 * cells + x0];
      const d = lattice[y1 * cells + x1];
      out[y * size + x] =
        a + (b - a) * tx + (c - a) * ty + (a - b - c + d) * tx * ty;
    }
  }
  return out;
}

function finish(canvas: HTMLCanvasElement, anisotropy: number): CanvasTexture {
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  texture.wrapS = RepeatWrapping;
  texture.wrapT = RepeatWrapping;
  texture.generateMipmaps = true;
  texture.minFilter = LinearMipmapLinearFilter;
  texture.magFilter = LinearFilter;
  texture.anisotropy = anisotropy;
  return texture;
}

function makeCanvas(width: number, height: number) {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas is not available");
  return { canvas, ctx };
}

/** One plaster tile covers this many metres of wall. */
export const PLASTER_TILE = 2.4;

/**
 * Hand-trowelled plaster: a warm off-white with slow mottling and a fine tooth.
 * The grain also dithers the long, dark light gradients so they do not band.
 */
export function createPlasterTexture(anisotropy: number): CanvasTexture {
  const size = 512;
  const { canvas, ctx } = makeCanvas(size, size);
  const image = ctx.createImageData(size, size);
  const slow = tileableNoise(size, 5, 11);
  const mid = tileableNoise(size, 23, 12);
  const fine = tileableNoise(size, 170, 13);
  const random = mulberry32(14);
  // sRGB #E9E3D8
  const base = [233, 227, 216];
  for (let i = 0; i < size * size; i++) {
    const v =
      (slow[i] - 0.5) * 0.04 +
      (mid[i] - 0.5) * 0.014 +
      (fine[i] - 0.5) * 0.022 +
      (random() - 0.5) * 0.016;
    const k = 1 + v;
    image.data[i * 4] = Math.min(255, base[0] * k);
    image.data[i * 4 + 1] = Math.min(255, base[1] * k);
    image.data[i * 4 + 2] = Math.min(255, base[2] * (k - v * 0.15));
    image.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(image, 0, 0);
  return finish(canvas, anisotropy);
}

/** One floor tile covers this many metres. */
export const FLOOR_TILE = 2.56;

/**
 * Dark oiled oak boards, running along the texture's v axis. Sixteen 16 cm boards per
 * tile with staggered butt joints; joints and grain wrap so the tile repeats cleanly.
 */
export function createOakTexture(anisotropy: number): CanvasTexture {
  const size = 1024;
  const boards = 16;
  const boardWidth = size / boards;
  const { canvas, ctx } = makeCanvas(size, size);
  const random = mulberry32(2718);

  for (let b = 0; b < boards; b++) {
    const x = b * boardWidth;
    // Cut the column into boards of 0.9–2.2 m (360–880 px of 1024 = 2.56 m).
    const joints: number[] = [];
    let y = random() * size;
    const start = y;
    while (y < start + size - 300) {
      joints.push(y % size);
      y += 360 + random() * 520;
    }
    joints.sort((p, q) => p - q);
    for (let j = 0; j < joints.length; j++) {
      const from = joints[j];
      const to = j + 1 < joints.length ? joints[j + 1] : joints[0] + size;
      const tone = 0.78 + random() * 0.44;
      const warmth = 0.94 + random() * 0.12;
      const r = Math.round(58 * tone * warmth);
      const g = Math.round(41 * tone);
      const bl = Math.round(29 * tone * (2 - warmth));
      ctx.fillStyle = `rgb(${r},${g},${bl})`;
      for (const offset of [0, -size]) {
        ctx.fillRect(x, from + offset, boardWidth, to - from);
      }
      // Grain: long, slightly wandering streaks, lighter and darker than the board.
      const streaks = 26;
      for (let s = 0; s < streaks; s++) {
        const sx = x + 1 + random() * (boardWidth - 2);
        const light = random() > 0.55;
        ctx.strokeStyle = light
          ? `rgba(150,112,78,${0.04 + random() * 0.07})`
          : `rgba(12,8,5,${0.06 + random() * 0.12})`;
        ctx.lineWidth = 0.6 + random() * 1.3;
        const wander = (random() - 0.5) * 5;
        for (const offset of [0, -size]) {
          ctx.beginPath();
          ctx.moveTo(sx, from + offset);
          ctx.bezierCurveTo(
            sx + wander,
            from + offset + (to - from) * 0.33,
            sx - wander,
            from + offset + (to - from) * 0.66,
            sx + wander * 0.4,
            to + offset,
          );
          ctx.stroke();
        }
      }
      // Butt joint.
      ctx.fillStyle = "rgba(6,4,3,0.75)";
      for (const offset of [0, -size, size]) {
        ctx.fillRect(x, from + offset - 0.75, boardWidth, 1.5);
      }
    }
    // Seam between neighbouring boards.
    ctx.fillStyle = "rgba(6,4,3,0.7)";
    ctx.fillRect(x - 0.75, 0, 1.5, size);
  }
  ctx.fillStyle = "rgba(6,4,3,0.7)";
  ctx.fillRect(size - 0.75, 0, 0.75, size);

  return finish(canvas, anisotropy);
}

/** One linen tile covers this many metres of canvas. */
export const LINEN_TILE = 0.064;

/**
 * Primed, unpainted linen. Shown inside the frame while an image loads and kept there
 * if it cannot be loaded. It is deliberately blank: no stand-in picture is ever drawn.
 */
export function createLinenTexture(anisotropy: number): CanvasTexture {
  const size = 128;
  const threads = 16;
  const pitch = size / threads;
  const { canvas, ctx } = makeCanvas(size, size);
  const random = mulberry32(99);
  ctx.fillStyle = "rgb(204,193,172)";
  ctx.fillRect(0, 0, size, size);
  for (let j = 0; j < threads; j++) {
    for (let i = 0; i < threads; i++) {
      const over = (i + j) % 2 === 0;
      const jitter = (random() - 0.5) * 0.05;
      const x = i * pitch;
      const y = j * pitch;
      // A raised thread catches the light on one side and shades the other.
      ctx.fillStyle = over
        ? `rgba(255,250,236,${0.13 + jitter})`
        : `rgba(70,58,40,${0.1 + jitter})`;
      ctx.fillRect(x + 0.5, y + 0.5, pitch - 1, pitch - 1);
      ctx.fillStyle = "rgba(60,48,34,0.16)";
      if (over) ctx.fillRect(x, y + pitch - 1, pitch, 1);
      else ctx.fillRect(x + pitch - 1, y, 1, pitch);
    }
  }
  return finish(canvas, anisotropy);
}
