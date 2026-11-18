"use client";

import { useCallback, useState } from "react";
import type { ArtworkImage as ArtworkImageData } from "@/lib/artwork/types";
import { cn } from "@/lib/utils";

/** Intrinsic size hints for layout; real size comes from srcset. */
const BASE_WIDTH = 843;

export interface ArtworkImageProps {
  image: ArtworkImageData;
  sizes: string;
  priority?: boolean;
  className?: string;
  /** Classes for the empty frame shown when the image cannot load. */
  fallbackClassName?: string;
}

export function ArtworkImage({
  image,
  sizes,
  priority = false,
  className,
  fallbackClassName,
}: ArtworkImageProps) {
  const [failed, setFailed] = useState(false);
  const height = Math.round(BASE_WIDTH / image.aspectRatio);

  // An image can fail before React hydrates and attaches onError; check once mounted.
  const checkLoaded = useCallback((node: HTMLImageElement | null) => {
    if (node && node.complete && node.naturalWidth === 0) setFailed(true);
  }, []);

  if (failed) {
    return (
      <div
        role="img"
        aria-label={`${image.alt} (image unavailable)`}
        style={{ aspectRatio: image.aspectRatio }}
        className={cn(
          "flex items-center justify-center bg-[#e4dccd] bg-[repeating-linear-gradient(0deg,rgb(34_33_31/0.035)_0_1px,transparent_1px_3px),repeating-linear-gradient(90deg,rgb(34_33_31/0.03)_0_1px,transparent_1px_3px)] text-xs tracking-[0.14em] text-muted uppercase",
          fallbackClassName,
        )}
      >
        Image unavailable
      </div>
    );
  }

  return (
    // IIIF images are hotlinked at fixed, museum-approved widths; next/image resizing is not used.
    <img
      ref={checkLoaded}
      src={image.src}
      srcSet={image.srcSet}
      sizes={sizes}
      alt={image.alt}
      width={BASE_WIDTH}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : "auto"}
      decoding="async"
      onError={() => setFailed(true)}
      className={className}
    />
  );
}
