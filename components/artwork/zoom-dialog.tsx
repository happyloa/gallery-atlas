"use client";

import type OpenSeadragon from "openseadragon";
import { useEffect, useId, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Expand, Minus, Plus, X } from "@/components/ui/icons";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** The museum's largest single public-domain image width, used when deep zoom can't load. */
const ZOOM_WIDTH = 1686;
/** Fit to the window, or the image at its full available width (fallback view only). */
type Level = "fit" | "full";
/** "deep": tiled IIIF zoom. "image": the single large image, if tiles fail to load. */
type Mode = "loading" | "deep" | "image";

export interface ZoomDialogProps {
  src: string;
  /** IIIF info.json for tiled deep zoom; without it the single image is shown. */
  tileSource?: string | null;
  alt: string;
  title: string;
  aspectRatio: number;
}

/**
 * Full-screen view of a work. Uses the native <dialog> in modal mode, which gives focus
 * containment, Escape to close, an inert page behind, and focus returned to the opening
 * button. Deep zoom (OpenSeadragon on the museum's IIIF tiles) loads only when opened;
 * if it can't, the dialog falls back to the largest single image, panned by scrolling.
 */
export function ZoomDialog({
  src,
  tileSource,
  alt,
  title,
  aspectRatio,
}: ZoomDialogProps) {
  const { dict } = useI18n();
  const t = dict.zoom;
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const stageRef = useRef<HTMLDivElement>(null);
  const viewerRef = useRef<OpenSeadragon.Viewer | null>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>("fit");
  /** The tiles could not be loaded; the single large image is shown from then on. */
  const [tilesFailed, setTilesFailed] = useState(false);
  /** The deep-zoom viewer has drawn the image. */
  const [viewerReady, setViewerReady] = useState(false);
  const mode: Mode =
    !tileSource || tilesFailed ? "image" : viewerReady ? "deep" : "loading";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setOpen(false);
      setLevel("fit");
      setViewerReady(false);
    };
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  useEffect(() => {
    if (!open) return;
    // The page behind is inert but can still scroll on some browsers; hold it still.
    const previous = document.documentElement.style.overflow;
    document.documentElement.style.overflow = "hidden";
    return () => {
      document.documentElement.style.overflow = previous;
    };
  }, [open]);

  // Deep zoom: load OpenSeadragon on first open and point it at the IIIF tiles. One viewer
  // per opening: this must not depend on anything the viewer itself changes when it opens,
  // or the cleanup would destroy the viewer that has just finished loading.
  useEffect(() => {
    if (!open || !tileSource || tilesFailed) return;
    const element = stageRef.current;
    if (!element) return;
    let cancelled = false;
    void import("openseadragon")
      .then(({ default: OSD }) => {
        if (cancelled) return;
        const reduced = window.matchMedia(
          "(prefers-reduced-motion: reduce)",
        ).matches;
        const viewer = OSD({
          element,
          tileSources: tileSource,
          crossOriginPolicy: "Anonymous",
          showNavigationControl: false,
          gestureSettingsMouse: { clickToZoom: true, scrollToZoom: true },
          animationTime: reduced ? 0 : 0.8,
          springStiffness: reduced ? 100 : 8,
          visibilityRatio: 0.5,
          minZoomImageRatio: 0.8,
          maxZoomPixelRatio: 2,
        });
        viewer.addOnceHandler("open", () => {
          if (!cancelled) setViewerReady(true);
        });
        viewer.addOnceHandler("open-failed", () => {
          if (!cancelled) setTilesFailed(true);
          viewer.destroy();
          viewerRef.current = null;
        });
        viewerRef.current = viewer;
      })
      .catch(() => {
        if (!cancelled) setTilesFailed(true);
      });
    return () => {
      cancelled = true;
      viewerRef.current?.destroy();
      viewerRef.current = null;
    };
  }, [open, tileSource, tilesFailed]);

  const show = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const zoomBy = (factor: number) => {
    const viewer = viewerRef.current;
    if (!viewer) return;
    viewer.viewport.zoomBy(factor);
    viewer.viewport.applyConstraints();
  };

  const iconButton = cn(
    buttonStyles({ variant: "secondary", tone: "dark", size: "sm" }),
    "size-11 px-0",
  );
  const deep = mode !== "image";

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={buttonStyles({ variant: "secondary", size: "sm" })}
      >
        <Expand className="size-4" />
        {t.open}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
        data-tone="dark"
        className="m-0 h-dvh max-h-none w-dvw max-w-none bg-gallery p-0 text-gallery-text backdrop:bg-black/80"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 border-b border-white/10 px-4 py-3 sm:px-6">
            <h2
              id={titleId}
              className="min-w-0 truncate font-serif text-lg italic"
            >
              {format(t.dialogLabel, { title })}
            </h2>
            <div className="flex shrink-0 gap-2">
              {deep ? (
                <>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => zoomBy(1 / 1.6)}
                    disabled={mode !== "deep"}
                    aria-label={t.zoomOut}
                  >
                    <Minus className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => zoomBy(1.6)}
                    disabled={mode !== "deep"}
                    aria-label={t.zoomIn}
                  >
                    <Plus className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={cn(
                      buttonStyles({
                        variant: "secondary",
                        tone: "dark",
                        size: "sm",
                      }),
                      "hidden sm:inline-flex",
                    )}
                    onClick={() => viewerRef.current?.viewport.goHome()}
                    disabled={mode !== "deep"}
                  >
                    {t.fit}
                  </button>
                </>
              ) : (
                <>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => setLevel("fit")}
                    disabled={level === "fit"}
                    aria-label={t.zoomOut}
                  >
                    <Minus className="size-4" />
                  </button>
                  <button
                    type="button"
                    className={iconButton}
                    onClick={() => setLevel("full")}
                    disabled={level === "full"}
                    aria-label={t.zoomIn}
                  >
                    <Plus className="size-4" />
                  </button>
                </>
              )}
              <button
                type="button"
                className={iconButton}
                onClick={close}
                aria-label={t.close}
              >
                <X className="size-4" />
              </button>
            </div>
          </div>

          {deep ? (
            // OpenSeadragon draws into this element and handles mouse, touch and keys.
            <div
              ref={stageRef}
              role="region"
              aria-label={alt}
              className={cn(
                "relative min-h-0 flex-1 transition-opacity duration-500",
                mode === "loading" && "opacity-0",
              )}
            />
          ) : (
            /* Scrollable stage. A scrollable region must be keyboard-focusable (axe:
               scrollable-region-focusable) so the arrow keys can pan the zoomed image. */
            <div
              // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
              tabIndex={0}
              aria-label={alt}
              role="region"
              className={cn(
                "scrollbar-dark min-h-0 flex-1 overflow-auto focus-visible:outline-offset-[-4px]",
                level === "fit" &&
                  "flex items-center justify-center p-4 sm:p-8",
              )}
            >
              {open ? (
                // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events -- the +/- buttons are the keyboard path
                <img
                  src={src}
                  alt={alt}
                  width={ZOOM_WIDTH}
                  height={Math.round(ZOOM_WIDTH / aspectRatio)}
                  decoding="async"
                  onClick={() => setLevel(level === "fit" ? "full" : "fit")}
                  className={cn(
                    "mx-auto block",
                    level === "fit"
                      ? "h-auto max-h-full w-auto max-w-full cursor-zoom-in"
                      : "max-w-none cursor-zoom-out",
                  )}
                />
              ) : null}
            </div>
          )}
        </div>
      </dialog>
    </>
  );
}
