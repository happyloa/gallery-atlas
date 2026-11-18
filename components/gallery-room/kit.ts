/**
 * What every part of the room is built with: the scene, the renderer, the layout, a
 * disposal tracker and the lightmap bake queue.
 */
import type { Scene, Texture, WebGLRenderer } from "three";
import { createLightmapBake } from "./bake";
import type {
  BakeLighting,
  BakeOptions,
  BakeSurface,
  LightmapBake,
} from "./bake";
import type { RoomLayout } from "./layout";
import type { RoomSurfaces } from "./surfaces";

export interface Disposable {
  dispose(): void;
}

export interface SceneKit {
  renderer: WebGLRenderer;
  scene: Scene;
  layout: RoomLayout;
  surfaces: RoomSurfaces;
  anisotropy: number;
  /** Registers something to free in dispose(). Returns it unchanged. */
  track<T extends Disposable>(item: T): T;
}

export interface Tracker {
  track<T extends Disposable>(item: T): T;
  disposeAll(): void;
}

export function createTracker(): Tracker {
  const items: Disposable[] = [];
  return {
    track(item) {
      items.push(item);
      return item;
    },
    disposeAll() {
      for (const item of items) item.dispose();
      items.length = 0;
    },
  };
}

/**
 * Lightmaps are handed out empty and baked afterwards, a few milliseconds at a time,
 * so building the room never holds the main thread for one long stretch.
 */
export interface BakeQueue {
  /** An empty lightmap texture for `surface`; it fills in as the queue runs. */
  lightmap(surface: BakeSurface, options: BakeOptions): Texture;
  /**
   * Runs queued bakes until `outOfTime` says stop. Returns true when the queue is empty.
   */
  run(outOfTime: () => boolean): boolean;
  clear(): void;
}

export function createBakeQueue(lighting: BakeLighting): BakeQueue {
  const pending: LightmapBake[] = [];
  return {
    lightmap(surface, options) {
      const bake = createLightmapBake(surface, lighting, options);
      pending.push(bake);
      return bake.texture;
    },
    run(outOfTime) {
      while (pending.length > 0) {
        const finished = pending[0].run(outOfTime);
        if (finished) pending.shift();
        if (!finished || outOfTime()) return pending.length === 0;
      }
      return true;
    },
    clear() {
      pending.length = 0;
    },
  };
}
