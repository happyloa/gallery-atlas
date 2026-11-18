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
