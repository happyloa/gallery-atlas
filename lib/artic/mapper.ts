/**
 * Raw API record → domain `Artwork`. This is where the display rule is enforced on the
 * server: a work becomes displayable only when the museum marks it public domain AND it
 * has a valid image id AND the IIIF base checks out. Everything else maps to null.
 */
import type { Artist, Artwork, ArtworkDetail } from "@/lib/artwork/types";
import {
  MAX_SOUNDS,
  MAX_TAG_LENGTH,
  museumArtistUrl,
  museumArtworkUrl,
} from "./config";
import type { TagKind } from "./config";
import { colorForHsl, eraForYear } from "./filters";
import {
  aspectRatioFrom,
  buildArtworkImage,
  iiifUrl,
  isValidImageId,
  safePlaceholder,
} from "./images";
import { parseDescription } from "./description";
import {
  rawArtistSchema,
  rawArtworkExtrasSchema,
  rawArtworkSchema,
} from "./schema";

const MAX_TEXT_LENGTH = 600;

/** Sound ids are UUIDs; anything else is not sent upstream. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

/** Like cleanText, but keeps single line breaks (artist_display puts dates on a second line). */
function cleanMultiline(value: string | null | undefined, max = 400): string | null {
  if (typeof value !== "string") return null;
  const lines = value
    .split(/\r?\n/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);
  if (lines.length === 0) return null;
  const joined = lines.join("\n");
  return joined.length > max ? `${joined.slice(0, max - 1).trimEnd()}…` : joined;
}

/** Detail view of a displayable work, or null under the same rule as toArtwork. */
export function toArtworkDetail(input: unknown, iiifBase: string | null): ArtworkDetail | null {
  const artwork = toArtwork(input, iiifBase);
  if (!artwork || !iiifBase) return null;
  const raw = rawArtworkSchema.parse(input);
  const extras = rawArtworkExtrasSchema.parse(input);
  const color = extras.color;
  return {
    ...artwork,
    artistDisplay: cleanMultiline(raw.artist_display),
    description: parseDescription(raw.description),
    // toArtwork already checked public-domain status and the image id.
    zoomSrc: iiifUrl(iiifBase, raw.image_id as string, 1686, true),
    tileSource: `${iiifBase}/${raw.image_id as string}/info.json`,
    artistId: extras.artist_id ?? null,
    era: eraForYear(extras.date_start),
    dominantColor: color
      ? {
          css: `hsl(${Math.round(color.h)} ${Math.round(color.s)}% ${Math.round(color.l)}%)`,
          slug: colorForHsl(color),
        }
      : null,
    tags: {
      style: cleanTags(extras.style_titles, TAG_LIMITS.style),
      subject: cleanTags(extras.subject_titles, TAG_LIMITS.subject),
      theme: cleanTags(extras.theme_titles, TAG_LIMITS.theme),
    },
    onView:
      extras.is_on_view === true
        ? {
            gallery: cleanText(extras.gallery_title, 120),
            galleryId: extras.gallery_id ?? null,
          }
        : null,
    soundIds: (extras.sound_ids ?? [])
      .filter((id): id is string => typeof id === "string" && UUID.test(id))
      .slice(0, MAX_SOUNDS),
    record: {
      inscriptions: cleanParagraphs(extras.inscriptions),
      provenance: cleanParagraphs(extras.provenance_text),
      exhibitions: cleanParagraphs(extras.exhibition_history),
      publications: cleanParagraphs(extras.publication_history),
    },
  };
}

/** How many of each kind of tag a detail page lists. */
const TAG_LIMITS: Record<TagKind, number> = { style: 8, subject: 12, theme: 6 };

/**
 * Tag strings that can double as exact search filters: trimmed, short enough to pass the
 * filter's own length check, and without case-insensitive duplicates.
 */
export function cleanTags(values: readonly unknown[] | null | undefined, max: number): string[] {
  const seen = new Set<string>();
  const tags: string[] = [];
  for (const value of values ?? []) {
    if (typeof value !== "string") continue;
    const tag = value.replace(/\s+/g, " ").trim();
    const key = tag.toLowerCase();
    if (!tag || Array.from(tag).length > MAX_TAG_LENGTH || seen.has(key)) continue;
    seen.add(key);
    tags.push(tag);
    if (tags.length === max) break;
  }
  return tags;
}

/** Longest object-record text kept; the rest is on the museum's page. */
const MAX_RECORD_LENGTH = 6000;

/** Plain text split into one paragraph per line, whitespace tidied, length capped. */
export function cleanParagraphs(value: string | null | undefined): string[] | null {
  if (typeof value !== "string") return null;
  const paragraphs: string[] = [];
  let used = 0;
  for (const block of value.split(/\r?\n/)) {
    const text = block.replace(/\s+/g, " ").trim();
    if (!text) continue;
    if (used + text.length > MAX_RECORD_LENGTH) {
      const room = MAX_RECORD_LENGTH - used;
      if (room > 80) paragraphs.push(`${text.slice(0, room - 1).trimEnd()}…`);
      else paragraphs.push("…");
      break;
    }
    paragraphs.push(text);
    used += text.length;
  }
  return paragraphs.length > 0 ? paragraphs : null;
}

/** An artist record, or null when it is unusable (no id or name). */
export function toArtist(input: unknown): Artist | null {
  const parsed = rawArtistSchema.safeParse(input);
  if (!parsed.success) return null;
  const raw = parsed.data;
  const name = cleanText(raw.title, 200);
  if (!name) return null;
  const year = (value: number | null | undefined) =>
    typeof value === "number" && value > -10000 && value < 3000 ? value : null;
  return {
    id: raw.id,
    name,
    birthYear: year(raw.birth_date),
    deathYear: year(raw.death_date),
    description: parseDescription(raw.description),
    sourceUrl: museumArtistUrl(raw.id),
  };
}
