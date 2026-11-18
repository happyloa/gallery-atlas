"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { ArtworkImage as ArtworkImageData } from "@/lib/artwork/types";
import { cn } from "@/lib/utils";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { observeOnce } from "@/lib/motion/observe";

/** Intrinsic size hints for layout; real size comes from srcset. */
const BASE_WIDTH = 843;

export interface ArtworkImageProps {
  image: ArtworkImageData;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Classes for the empty frame shown when the image cannot load. */
  fallbackClassName?: string;
  /**
   * Uncover the image from the bottom the first time it scrolls into view. Milliseconds of
   * delay, for staggered rows; `false` (the default) shows it at once.
   */
  reveal?: number | false;
  /**
   * The alt text was written in the page's language. By default it is the museum's own
   * description, which is English, and is marked as such on a Chinese page.
   */
  translatedAlt?: boolean;
}

export function ArtworkImage({
  image,
  sizes,
  priority = false,
  className,
  fallbackClassName,
  reveal = false,
  translatedAlt = false,
}: ArtworkImageProps) {
  const { locale, dict } = useI18n();
  const [failed, setFailed] = useState(false);
  const [shown, setShown] = useState(false);
  const nodeRef = useRef<HTMLImageElement | null>(null);
  const height = Math.round(BASE_WIDTH / image.aspectRatio);
  const revealing = reveal !== false;

  // An image can fail before React hydrates and attaches onError; check once mounted.
  const attach = useCallback((node: HTMLImageElement | null) => {
    nodeRef.current = node;
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  useEffect(() => {
    const node = nodeRef.current;
    if (!revealing || !node) return;
    // Watch the frame around the image: Chromium counts the image's own clip-path, so a fully
    // clipped image would never be reported as visible.
    return observeOnce(node.parentElement ?? node, () => setShown(true));
  }, [revealing]);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={format(dict.artwork.imageUnavailableLabel, {
          alt: image.alt,
        })}
        style={{ aspectRatio: image.aspectRatio }}
        className={cn(
          "flex items-center justify-center bg-[#e4dccd] bg-[repeating-linear-gradient(0deg,rgb(34_33_31/0.035)_0_1px,transparent_1px_3px),repeating-linear-gradient(90deg,rgb(34_33_31/0.03)_0_1px,transparent_1px_3px)] text-xs tracking-[0.14em] text-muted uppercase",
          fallbackClassName,
        )}
      >
        {dict.artwork.imageUnavailable}
      </div>
    );
  }

  return (
    // IIIF images are hotlinked at fixed, museum-approved widths; next/image resizing is not used.
    <img
      ref={attach}
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={image.alt}
      lang={image.alt && !translatedAlt && locale !== "en" ? "en" : undefined}
      width={BASE_WIDTH}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      data-reveal={revealing ? (shown ? "shown" : "hidden") : undefined}
      className={className}
      style={
        {
          // Layout follows the museum's recorded proportions, not whichever file width loaded.
          aspectRatio: image.aspectRatio,
          // The API's tiny blurred preview fills the box until the image arrives. The mapper
          // only passes through validated base64 data URIs, so it is safe inside url().
          ...(image.placeholder
            ? {
                backgroundImage: `url("${image.placeholder}")`,
                backgroundSize: "100% 100%",
              }
            : {}),
          ...(revealing && reveal > 0
            ? { "--reveal-delay": `${reveal}ms` }
            : {}),
        } as CSSProperties
      }
    />
  );
}
