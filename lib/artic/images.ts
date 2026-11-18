/**
 * Safe IIIF image URLs. Only the museum's own IIIF host is accepted, image ids must look
 * like the museum's UUIDs, and only the widths the museum documents are ever requested.
 */
import type { ArtworkImage, IiifWidth } from "@/lib/artwork/types";

/** Origins and path the IIIF base from the API's `config.iiif_url` must match. */
const ALLOWED_IIIF_ORIGINS = new Set(["https://www.artic.edu"]);
const IIIF_PATH = "/iiif/2";

const IMAGE_ID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Widths any work may use; 1200 and 1686 are allowed for public-domain works only. */
const OPEN_WIDTHS: readonly IiifWidth[] = [200, 400, 600, 843];
const PUBLIC_DOMAIN_WIDTHS: readonly IiifWidth[] = [1200, 1686];

/** Widths offered in card and detail srcsets. */
const SRCSET_WIDTHS: readonly IiifWidth[] = [400, 600, 843, 1200];

const DEFAULT_ASPECT_RATIO = 4 / 5;

/**
 * Validates the IIIF base the API reports. Returns a normalised base without a trailing
 * slash, or null when it is missing or points anywhere but the museum's IIIF server.
 */
export function resolveIiifBase(raw: string | null | undefined): string | null {
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  const path = url.pathname.replace(/\/+$/, "");
  if (
    !ALLOWED_IIIF_ORIGINS.has(url.origin) ||
    path !== IIIF_PATH ||
    url.search ||
    url.hash
  )
    return null;
  return `${url.origin}${path}`;
}

export function isValidImageId(
  imageId: string | null | undefined,
): imageId is string {
  return typeof imageId === "string" && IMAGE_ID_PATTERN.test(imageId);
}

export function isAllowedWidth(
  width: number,
  isPublicDomain: boolean,
): width is IiifWidth {
  return (
    OPEN_WIDTHS.includes(width as IiifWidth) ||
    (isPublicDomain && PUBLIC_DOMAIN_WIDTHS.includes(width as IiifWidth))
  );
}

/** One IIIF URL, or null when any part fails validation. */
export function iiifUrl(
  base: string,
  imageId: string,
  width: number,
  isPublicDomain: boolean,
): string | null {
  if (
    resolveIiifBase(base) !== base ||
    !isValidImageId(imageId) ||
    !isAllowedWidth(width, isPublicDomain)
  )
    return null;
  return `${base}/${imageId}/full/${width},/0/default.jpg`;
}

/** Width / height from the API thumbnail, or a stable 4:5 fallback when it is missing or odd. */
export function aspectRatioFrom(
  width: number | null | undefined,
  height: number | null | undefined,
): number {
  if (
    !width ||
    !height ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    return DEFAULT_ASPECT_RATIO;
  }
  const ratio = width / height;
  return Math.min(5, Math.max(0.2, Number(ratio.toFixed(4))));
}

/** The API's tiny base64 preview; kept only when it is a small inline image. */
export function safePlaceholder(
  lqip: string | null | undefined,
): string | null {
  if (!lqip || lqip.length > 4000) return null;
  return /^data:image\/(gif|png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(lqip)
    ? lqip
    : null;
}

export function buildArtworkImage(input: {
  base: string;
  imageId: string;
  aspectRatio: number;
  alt: string;
  placeholder: string | null;
}): ArtworkImage | null {
  const src = iiifUrl(input.base, input.imageId, 843, true);
  if (!src) return null;
  const srcSet = SRCSET_WIDTHS.map(
    (width) => `${iiifUrl(input.base, input.imageId, width, true)} ${width}w`,
  ).join(", ");
  return {
    src,
    srcSet,
    aspectRatio: input.aspectRatio,
    alt: input.alt,
    placeholder: input.placeholder,
  };
}
