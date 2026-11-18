"use client";

import { useEffect, useId, useRef, useState } from "react";
import { buttonStyles } from "@/components/ui/button";
import { Expand, Minus, Plus, X } from "@/components/ui/icons";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** The museum's largest public-domain IIIF width. */
const ZOOM_WIDTH = 1686;
/** Fit to the window, or the image at its full available width. */
type Level = "fit" | "full";

export interface ZoomDialogProps {
  src: string;
  alt: string;
  title: string;
  aspectRatio: number;
}

/**
 * Full-screen view of a work. Uses the native <dialog> in modal mode, which gives focus
 * containment, Escape to close, an inert page behind, and focus returned to the opening
 * button. Panning is plain scrolling, so it works with touch, trackpad and arrow keys.
 */
export function ZoomDialog({ src, alt, title, aspectRatio }: ZoomDialogProps) {
  const { dict } = useI18n();
  const t = dict.zoom;
  const titleId = useId();
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [open, setOpen] = useState(false);
  const [level, setLevel] = useState<Level>("fit");

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    const onClose = () => {
      setOpen(false);
      setLevel("fit");
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

  const show = () => {
    setOpen(true);
    dialogRef.current?.showModal();
  };
  const close = () => dialogRef.current?.close();

  const iconButton = cn(
    buttonStyles({ variant: "secondary", tone: "dark", size: "sm" }),
    "size-11 px-0",
  );

  return (
    <>
      <button
        type="button"
        onClick={show}
        className={buttonStyles({ variant: "secondary", size: "sm" })}
      >
        <Expand className="size-4" />
        {dict.detail.viewFullImage}
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby={titleId}
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

          {/* Scrollable stage. A scrollable region must be keyboard-focusable (axe:
              scrollable-region-focusable) so the arrow keys can pan the zoomed image. */}
          <div
            // eslint-disable-next-line jsx-a11y/no-noninteractive-tabindex
            tabIndex={0}
            aria-label={alt}
            role="region"
            className={cn(
              "scrollbar-dark min-h-0 flex-1 overflow-auto focus-visible:outline-offset-[-4px]",
              level === "fit" && "flex items-center justify-center p-4 sm:p-8",
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

          <p className="border-t border-white/10 px-4 py-2 text-xs text-gallery-muted sm:px-6">
            {format(t.maxSize, { width: ZOOM_WIDTH })}
          </p>
        </div>
      </dialog>
    </>
  );
}
