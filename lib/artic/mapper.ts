/**
 * Raw API record → domain `Artwork`. This is where the display rule is enforced on the
 * server: a work becomes displayable only when the museum marks it public domain AND it
 * has a valid image id AND the IIIF base checks out. Everything else maps to null.
 */
import type { Artwork } from "@/lib/artwork/types";
import { museumArtworkUrl } from "./config";
import {
  aspectRatioFrom,
  buildArtworkImage,
  isValidImageId,
  safePlaceholder,
} from "./images";
import { rawArtworkSchema } from "./schema";

const MAX_TEXT_LENGTH = 600;

/** Trims, collapses whitespace, caps length; empty → null. */
function cleanText(
  value: string | null | undefined,
  max = MAX_TEXT_LENGTH,
): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value.replace(/\s+/g, " ").trim();
  if (!cleaned) return null;
  return cleaned.length > max
    ? `${cleaned.slice(0, max - 1).trimEnd()}…`
    : cleaned;
}

export const UNKNOWN_ARTIST = "Artist unknown";

export function toArtwork(
  input: unknown,
  iiifBase: string | null,
): Artwork | null {
  const parsed = rawArtworkSchema.safeParse(input);
  if (!parsed.success || !iiifBase) return null;
  const raw = parsed.data;

  // The display rule. Having an image id does not make a work public domain.
  if (raw.is_public_domain !== true || !isValidImageId(raw.image_id))
    return null;

  const title = cleanText(raw.title, 300) ?? "Untitled";
  const artist = cleanText(raw.artist_title, 200) ?? UNKNOWN_ARTIST;
  const alt =
    cleanText(raw.thumbnail?.alt_text, 400) ??
    (artist === UNKNOWN_ARTIST
      ? `${title}, artist unknown`
      : `${title} by ${artist}`);

  const image = buildArtworkImage({
    base: iiifBase,
    imageId: raw.image_id,
    aspectRatio: aspectRatioFrom(raw.thumbnail?.width, raw.thumbnail?.height),
    alt,
    placeholder: safePlaceholder(raw.thumbnail?.lqip),
  });
  if (!image) return null;

  return {
    id: raw.id,
    title,
    artist,
    dateDisplay: cleanText(raw.date_display, 200),
    type: cleanText(raw.artwork_type_title, 100),
    medium: cleanText(raw.medium_display),
    dimensions: cleanText(raw.dimensions),
    origin: cleanText(raw.place_of_origin, 200),
    creditLine: cleanText(raw.credit_line),
    image,
    sourceUrl: museumArtworkUrl(raw.id),
    isPublicDomain: true,
  };
}

/** Maps a list, dropping anything that is not displayable. Also drops duplicate ids. */
export function toArtworks(
  records: readonly unknown[],
  iiifBase: string | null,
): Artwork[] {
  const seen = new Set<number>();
  const artworks: Artwork[] = [];
  for (const record of records) {
    const artwork = toArtwork(record, iiifBase);
    if (!artwork || seen.has(artwork.id)) continue;
    seen.add(artwork.id);
    artworks.push(artwork);
  }
  return artworks;
}
