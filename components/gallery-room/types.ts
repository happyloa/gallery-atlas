/**
 * Shared types for the WebGL gallery room. This file has no runtime code and no
 * three.js imports, so the React wrapper can use it without pulling three into the
 * initial bundle.
 */

/** What the room needs to hang one work. Derive it from the domain `Artwork`. */
export interface RoomArtwork {
  id: number;
  title: string;
  artist: string;
  /** IIIF URL, e.g. `artwork.image.src`. Loaded with `crossOrigin = "anonymous"`. */
  textureUrl: string;
  /** width / height */
  aspectRatio: number;
  /** AIC dimensions string ("H × W cm (...); Framed: H × W × D cm"), or null. */
  dimensions: string | null;
}

/**
 * How the camera treats the room. "hero" holds the work off-centre behind the homepage
 * headline. "tour" stands close and centred, and draws only when something moves, because
 * a tour can stay on screen for half an hour.
 */
export type RoomFraming = "hero" | "tour";

export interface GallerySceneOptions {
  /** 1–8 works. Extra works beyond 8 are ignored. */
  artworks: RoomArtwork[];
  initialIndex: number;
  reducedMotion: boolean;
  framing?: RoomFraming;
  /** The user clicked or tapped a painting in the canvas. */
  onActiveChange?: (index: number) => void;
  /** The first frame has been drawn. */
  onReady?: () => void;
  onTextureError?: (id: number) => void;
}

export interface GalleryScene {
  /** Walk the camera to stand in front of `artworks[index]`. */
  focus(index: number): void;
  /** Normalised pointer position: x -1 (left) .. 1 (right), y -1 (bottom) .. 1 (top). */
  setPointer(x: number, y: number): void;
  /** 0..1 as the hero scrolls out of view. */
  setScrollProgress(p: number): void;
  /** Size of the canvas in CSS pixels. */
  resize(width: number, height: number): void;
  setReducedMotion(reduced: boolean): void;
  pause(): void;
  resume(): void;
  /** Frees geometries, materials, textures, render targets, the renderer and listeners. */
  dispose(): void;
}
