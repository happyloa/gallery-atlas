"use client";

import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import type { GalleryScene, RoomArtwork, RoomFraming } from "./types";

export type { RoomArtwork, RoomFraming } from "./types";

export interface GalleryRoomProps {
  /** 1–8 works. The room is rebuilt only when their content changes, not their identity. */
  artworks: RoomArtwork[];
  /** "hero" (the default) for the homepage, "tour" beside an audio tour. */
  framing?: RoomFraming;
  /** Controlled: the work the camera stands in front of. */
  activeIndex: number;
  /** A painting was clicked or tapped in the canvas. */
  onActiveIndexChange: (index: number) => void;
  /**
   * The room has drawn its first frame and is fading in. That is after the lighting is
   * baked and the opening work's image has loaded or failed (it waits 2.5 s at most).
   */
  onReady?: () => void;
  /** No WebGL, a lost context, or an error while building the room. Show the fallback. */
  onUnavailable?: () => void;
  /**
   * An image could not be loaded. The room keeps a blank primed canvas in that frame;
   * the id lets the overlay say so.
   */
  onTextureError?: (id: number) => void;
  /** Sizes and positions the room, e.g. "absolute inset-0". The root is a grid box. */
  className?: string;
}

type ArtworkTuple = [
  id: number,
  title: string,
  artist: string,
  textureUrl: string,
  aspectRatio: number,
  dimensions: string | null,
];

/**
 * A software renderer would turn the room into a slideshow, so it counts as
 * "no WebGL": the static fallback is the better experience there.
 */
function hasCapableWebGL(): boolean {
  try {
    const probe = document.createElement("canvas");
    const gl = probe.getContext("webgl2", {
      failIfMajorPerformanceCaveat: true,
    });
    if (!gl) return false;
    gl.getExtension("WEBGL_lose_context")?.loseContext();
    return true;
  } catch {
    return false;
  }
}

/**
 * The 3D gallery room behind the hero. Decorative: the canvas is hidden from assistive
 * technology, and everything it shows is also available in the HTML around it.
 *
 * three.js is loaded on demand, in the browser only, after this component mounts.
 */
export function GalleryRoom({
  artworks,
  framing = "hero",
  activeIndex,
  onActiveIndexChange,
  onReady,
  onUnavailable,
  onTextureError,
  className,
}: GalleryRoomProps) {
  const stageRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<GalleryScene | null>(null);
  const activeIndexRef = useRef(activeIndex);
  /** The artworks key the canvas is currently showing, once its first frame is drawn. */
  const [readyKey, setReadyKey] = useState<string | null>(null);

  // Callers often build the array inline. Key the room on what the works are, so a new
  // array with the same works does not tear the scene down.
  const artworksKey = JSON.stringify(
    artworks.map((a): ArtworkTuple => [
      a.id,
      a.title,
      a.artist,
      a.textureUrl,
      a.aspectRatio,
      a.dimensions,
    ]),
  );
  const stableArtworks = useMemo(
    () =>
      (JSON.parse(artworksKey) as ArtworkTuple[]).map(
        ([
          id,
          title,
          artist,
          textureUrl,
          aspectRatio,
          dimensions,
        ]): RoomArtwork => ({
          id,
          title,
          artist,
          textureUrl,
          aspectRatio,
          dimensions,
        }),
      ),
    [artworksKey],
  );

  const emitReady = useEffectEvent(() => onReady?.());
  const emitUnavailable = useEffectEvent(() => onUnavailable?.());
  const emitActiveIndex = useEffectEvent((index: number) =>
    onActiveIndexChange(index),
  );
  const emitTextureError = useEffectEvent((id: number) => onTextureError?.(id));

  useEffect(() => {
    activeIndexRef.current = activeIndex;
    sceneRef.current?.focus(activeIndex);
  }, [activeIndex]);

  useEffect(() => {
    const stage = stageRef.current;
    const canvas = canvasRef.current;
    if (!stage || !canvas) return;

    if (!hasCapableWebGL()) {
      emitUnavailable();
      return;
    }

    let cancelled = false;
    let failed = false;
    let scene: GalleryScene | null = null;
    const cleanups: Array<() => void> = [];

    const teardown = () => {
      for (const cleanup of cleanups.splice(0)) cleanup();
      scene?.dispose();
      scene = null;
      sceneRef.current = null;
    };

    const fail = () => {
      if (cancelled || failed) return;
      failed = true;
      teardown();
      setReadyKey(null);
      emitUnavailable();
    };

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

    const onContextLost = (event: Event) => {
      event.preventDefault();
      fail();
    };
    canvas.addEventListener("webglcontextlost", onContextLost);

    import("./scene")
      .then(({ createGalleryScene }) => {
        if (cancelled || failed) return;
        try {
          scene = createGalleryScene(canvas, {
            artworks: stableArtworks,
            framing,
            initialIndex: activeIndexRef.current,
            reducedMotion: reducedMotion.matches,
            onActiveChange: (index) => {
              if (!cancelled) emitActiveIndex(index);
            },
            onReady: () => {
              if (cancelled) return;
              setReadyKey(artworksKey);
              emitReady();
            },
            onTextureError: (id) => {
              if (!cancelled) emitTextureError(id);
            },
          });
        } catch {
          fail();
          return;
        }
        const room = scene;
        sceneRef.current = room;
        // The index may have moved while three.js was downloading.
        room.focus(activeIndexRef.current);

        // Size.
        const measure = () => {
          const rect = stage.getBoundingClientRect();
          room.resize(rect.width, rect.height);
        };
        measure();
        const resizeObserver = new ResizeObserver(measure);
        resizeObserver.observe(stage);
        cleanups.push(() => resizeObserver.disconnect());

        // Only draw while someone can see it.
        let onScreen = true;
        const syncRunning = () => {
          if (onScreen && !document.hidden) room.resume();
          else room.pause();
        };
        const intersectionObserver = new IntersectionObserver((entries) => {
          onScreen = entries[entries.length - 1]?.isIntersecting ?? true;
          syncRunning();
        });
        intersectionObserver.observe(stage);
        document.addEventListener("visibilitychange", syncRunning);
        cleanups.push(() => {
          intersectionObserver.disconnect();
          document.removeEventListener("visibilitychange", syncRunning);
        });

        // Reduced motion, followed live.
        const onMotionChange = (event: MediaQueryListEvent) =>
          room.setReducedMotion(event.matches);
        reducedMotion.addEventListener("change", onMotionChange);
        cleanups.push(() =>
          reducedMotion.removeEventListener("change", onMotionChange),
        );

        // Pointer look-around and scroll progress, both read once per frame at most.
        let pointerEvent: PointerEvent | null = null;
        let scrollQueued = false;
        let frame = 0;
        const flush = () => {
          frame = 0;
          const rect = stage.getBoundingClientRect();
          if (pointerEvent && rect.width > 0 && rect.height > 0) {
            room.setPointer(
              ((pointerEvent.clientX - rect.left) / rect.width) * 2 - 1,
              -(((pointerEvent.clientY - rect.top) / rect.height) * 2 - 1),
            );
            pointerEvent = null;
          }
          if (scrollQueued) {
            scrollQueued = false;
            // 0 while the top of the hero is at or below the top of the viewport,
            // 1 once the whole hero has scrolled past it. A tour's room stays lit.
            room.setScrollProgress(
              framing === "hero" && rect.height > 0
                ? -rect.top / rect.height
                : 0,
            );
          }
        };
        const queue = () => {
          if (!frame) frame = requestAnimationFrame(flush);
        };
        const onPointerMove = (event: PointerEvent) => {
          if (event.pointerType === "touch") return;
          pointerEvent = event;
          queue();
        };
        const onPointerGone = () => {
          pointerEvent = null;
          room.setPointer(0, 0);
        };
        const onScroll = () => {
          scrollQueued = true;
          queue();
        };
        window.addEventListener("pointermove", onPointerMove, {
          passive: true,
        });
        document.documentElement.addEventListener(
          "pointerleave",
          onPointerGone,
        );
        window.addEventListener("blur", onPointerGone);
        window.addEventListener("scroll", onScroll, { passive: true });
        window.addEventListener("resize", onScroll, { passive: true });
        onScroll();
        cleanups.push(() => {
          cancelAnimationFrame(frame);
          window.removeEventListener("pointermove", onPointerMove);
          document.documentElement.removeEventListener(
            "pointerleave",
            onPointerGone,
          );
          window.removeEventListener("blur", onPointerGone);
          window.removeEventListener("scroll", onScroll);
          window.removeEventListener("resize", onScroll);
        });
      })
      .catch(fail);

    return () => {
      cancelled = true;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      teardown();
      // Hand the GPU context back once the canvas has really left the page. A Strict
      // Mode remount or a new set of works reuses the same canvas, so wait and check.
      window.setTimeout(() => {
        if (canvas.isConnected) return;
        canvas
          .getContext("webgl2")
          ?.getExtension("WEBGL_lose_context")
          ?.loseContext();
      }, 0);
    };
  }, [artworksKey, framing, stableArtworks]);

  const visible = readyKey === artworksKey;

  return (
    <div className={className ? `grid ${className}` : "grid"}>
      <div ref={stageRef} className="relative min-h-0 min-w-0 overflow-hidden">
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className={`absolute inset-0 block h-full w-full transition-opacity duration-1000 ease-out motion-reduce:transition-none ${
            visible ? "opacity-100" : "opacity-0"
          }`}
        />
      </div>
    </div>
  );
}
