/**
 * Fixed settings for talking to the Art Institute of Chicago API. Nothing here comes from
 * user input: the base URL, page size, fields and filter options are all server-owned.
 */

export const AIC_API_BASE = "https://api.artic.edu/api/v1";

/** Works per page in Explore. 12 fills 2-, 3- and 4-column grids evenly. */
export const PAGE_SIZE = 12;

/** The search endpoint refuses offsets beyond its first 1,000 results (verified: page 84 × 12 → 403). */
export const MAX_SEARCH_RESULTS = 1000;
export const MAX_PAGE = Math.floor(MAX_SEARCH_RESULTS / PAGE_SIZE);

export const MAX_QUERY_LENGTH = 100;

/** The API's own limit per request is 100; batch reads are split into chunks this size. */
export const MAX_IDS_PER_REQUEST = 50;

export const REQUEST_TIMEOUT_MS = 9000;

/** Seconds a cached upstream response stays fresh (vinext fetch cache). */
export const REVALIDATE_SEARCH = 10 * 60;
export const REVALIDATE_ARTWORK = 60 * 60;

export const ARTWORK_FIELDS = [
  "id",
  "title",
  "artist_title",
  "artist_display",
  "date_display",
  "artwork_type_title",
  "medium_display",
  "dimensions",
  "place_of_origin",
  "image_id",
  "thumbnail",
  "is_public_domain",
  "credit_line",
] as const;

/** Detail pages also need the (CC BY 4.0) description, the tags and the object record. */
export const ARTWORK_DETAIL_FIELDS = [
  ...ARTWORK_FIELDS,
  "description",
  "artist_id",
  "date_start",
  "color",
  "style_titles",
  "subject_titles",
  "theme_titles",
  "is_on_view",
  "gallery_title",
  "inscriptions",
  "provenance_text",
  "exhibition_history",
  "publication_history",
  "gallery_id",
  "sound_ids",
  "alt_titles",
  "main_reference_number",
  "department_id",
  "department_title",
  "edition",
  "date_qualifier_title",
  "alt_image_ids",
  "video_ids",
  "text_ids",
  "section_ids",
  "site_ids",
] as const;

/**
 * Type filters offered in Explore. Ids are AIC `artwork_type_id`s; every one of these had
 * well over 1,000 public-domain works with images when checked (2026-11-18), so a filter
 * never leads to an empty wall.
 */
export const ARTWORK_TYPES = [
  { slug: "painting", id: 1, label: "Painting" },
  { slug: "print", id: 18, label: "Print" },
  { slug: "drawing", id: 14, label: "Drawing" },
  { slug: "photograph", id: 2, label: "Photograph" },
  { slug: "sculpture", id: 3, label: "Sculpture" },
  { slug: "textile", id: 5, label: "Textile" },
  { slug: "ceramics", id: 36, label: "Ceramics" },
] as const;

export type ArtworkTypeSlug = (typeof ARTWORK_TYPES)[number]["slug"];

/** Canonical artwork page on the museum's site. Built from the numeric id only. */
export function museumArtworkUrl(id: number): string {
  return `https://www.artic.edu/artworks/${id}`;
}

/** Seconds that slow-changing data stays fresh: artist records and collection counts. */
export const REVALIDATE_REFERENCE = 24 * 60 * 60;

/**
 * The museum's CDN turns away request URLs much past 2,000 characters (403 at 2,083,
 * fine at 1,883 when checked on 2026-11-18). Searches longer than this are not sent.
 */
export const MAX_REQUEST_PATH = 1900;

/** Longest style, subject or theme value accepted from a URL. Real ones are far shorter. */
export const MAX_TAG_LENGTH = 60;

/**
 * Era filters, by the year a work was begun (`date_start`). Spans are uneven on purpose:
 * each holds at least a couple of thousand public-domain works with images (2026-11-18).
 */
export const ERAS = [
  { slug: "before-500", from: null, to: 500 },
  { slug: "500-1399", from: 500, to: 1400 },
  { slug: "1400-1599", from: 1400, to: 1600 },
  { slug: "1600s", from: 1600, to: 1700 },
  { slug: "1700s", from: 1700, to: 1800 },
  { slug: "1800s", from: 1800, to: 1900 },
  { slug: "1900s", from: 1900, to: null },
] as const;

export type EraSlug = (typeof ERAS)[number]["slug"];

/**
 * Colour filters on a work's dominant colour (`color.h` hue in degrees). Only fairly vivid
 * colours count (saturation and lightness bounds below), or most prints and drawings would
 * land in "ochre" for their paper. Purple and pink share a bucket: purple alone held about
 * twenty works. `swatch` is the colour drawn for the filter.
 */
export const COLORS = [
  { slug: "red", hues: [[345, 360], [0, 15]], swatch: "#a8402f" },
  { slug: "orange", hues: [[15, 35]], swatch: "#c46a2c" },
  { slug: "ochre", hues: [[35, 65]], swatch: "#c19a45" },
  { slug: "green", hues: [[65, 160]], swatch: "#5c7a48" },
  { slug: "teal", hues: [[160, 195]], swatch: "#3c7975" },
  { slug: "blue", hues: [[195, 255]], swatch: "#3b5b8c" },
  { slug: "violet", hues: [[255, 345]], swatch: "#7b4c78" },
] as const satisfies readonly {
  slug: string;
  hues: readonly (readonly [number, number])[];
  swatch: string;
}[];

export type ColorSlug = (typeof COLORS)[number]["slug"];

/** A colour counts as vivid enough to file under a hue within these bounds (0–100). */
export const VIVID = { minSaturation: 25, minLightness: 15, maxLightness: 85 } as const;

/** Which tag list a style, subject or theme filter searches. */
export const TAG_FIELDS = {
  style: "style_titles.keyword",
  subject: "subject_titles.keyword",
  theme: "theme_titles.keyword",
} as const;

/** Place-of-origin filter field (values are matched case-insensitively upstream). */
export const PLACE_FIELD = "place_of_origin.keyword";

export type TagKind = keyof typeof TAG_FIELDS;

/**
 * Curated ways into the collection on the homepage. Each is one style or theme tag from
 * the museum's own records, with a public-domain work from it as the cover.
 */
export const ENTRANCES = [
  { slug: "impressionism", kind: "style", value: "Impressionism", cover: 16568 },
  { slug: "post-impressionism", kind: "style", value: "Post-Impressionism", cover: 61128 },
  { slug: "japanese", kind: "style", value: "Japanese (culture or style)", cover: 89503 },
  { slug: "chinese", kind: "style", value: "Chinese (culture or style)", cover: 35376 },
  { slug: "egyptian", kind: "style", value: "egyptian", cover: 127859 },
  { slug: "americas", kind: "style", value: "Arts of the Americas", cover: 91620 },
  { slug: "women-artists", kind: "theme", value: "Women artists", cover: 111442 },
  { slug: "icons", kind: "theme", value: "Art Institute Icons", cover: 87479 },
] as const satisfies readonly {
  slug: string;
  kind: TagKind;
  value: string;
  cover: number;
}[];

export type EntranceSlug = (typeof ENTRANCES)[number]["slug"];

/** Canonical artist page on the museum's site. Built from the numeric id only. */
export function museumArtistUrl(id: number): string {
  return `https://www.artic.edu/artists/${id}`;
}

/** Result orders offered in Explore. "relevance" is the default and stays out of URLs. */
export const SORTS = ["relevance", "oldest", "newest"] as const;
export type SortSlug = (typeof SORTS)[number];

/**
 * When sorting by date, ignore start years outside this span: a few records carry
 * placeholder values (e.g. -1824528578) that would otherwise always sort first.
 */
export const SANE_YEARS = { from: -8000, to: 2030 } as const;

/** Museum exhibitions per page on the exhibitions index. */
export const EXHIBITIONS_PAGE_SIZE = 12;

/** Most audio recordings listed for one work. */
export const MAX_SOUNDS = 4;

/** Works in one shared exhibition link; matches the limit of a saved exhibition. */
export const MAX_SHARED_WORKS = 100;

/** Articles and publications listed under "Further reading". */
export const MAX_READING = 3;

export function museumArticleUrl(id: number): string {
  return `https://www.artic.edu/articles/${id}`;
}
