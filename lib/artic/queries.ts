/**
 * Whitelisted search parameters and the fixed query sent upstream.
 *
 * Visitors control three things: a keyword (≤ 100 chars), a type from a fixed list, and a
 * page within the API's 1,000-result window. They never supply a URL or query DSL.
 */
import { z } from "zod";
import {
  ARTWORK_FIELDS,
  ARTWORK_TYPES,
  MAX_PAGE,
  MAX_QUERY_LENGTH,
  PAGE_SIZE,
} from "./config";
import type { ArtworkTypeSlug } from "./config";
import type { SearchQuery } from "./search-url";

export type { SearchQuery } from "./search-url";
export { searchHref, toSearchParams } from "./search-url";

export type SearchQueryError =
  | { code: "invalid_page"; message: string }
  | { code: "page_out_of_range"; message: string };

export type SearchQueryResult =
  | { ok: true; query: SearchQuery }
  /** `query` is the same request with the page reset to 1, for "start over" links. */
  | { ok: false; error: SearchQueryError; query: SearchQuery };

type RawParams =
  URLSearchParams | Record<string, string | string[] | undefined>;

function first(params: RawParams, key: string): string | undefined {
  if (params instanceof URLSearchParams) return params.get(key) ?? undefined;
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

const typeSlugs = ARTWORK_TYPES.map((t) => t.slug) as [
  ArtworkTypeSlug,
  ...ArtworkTypeSlug[],
];
const typeSchema = z.enum(typeSlugs);
const pageSchema = z.string().regex(/^\d{1,6}$/);

/** Collapses whitespace and caps the keyword at the maximum length. */
export function normalizeKeyword(value: string | undefined): string {
  if (!value) return "";
  // Turn control characters into spaces, then collapse whitespace.
  const cleaned = Array.from(value, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f ? " " : char;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, MAX_QUERY_LENGTH).join("").trim();
}

export function parseSearchQuery(params: RawParams): SearchQueryResult {
  const q = normalizeKeyword(first(params, "q"));
  const typeResult = typeSchema.safeParse(first(params, "type"));
  // Unknown types are ignored rather than rejected: an old or edited link still works.
  const type = typeResult.success ? typeResult.data : null;
  const base: SearchQuery = { q, type, page: 1 };

  const rawPage = first(params, "page");
  if (rawPage === undefined || rawPage === "") return { ok: true, query: base };

  if (!pageSchema.safeParse(rawPage).success || Number(rawPage) < 1) {
    return {
      ok: false,
      error: {
        code: "invalid_page",
        message: "Page must be a whole number from 1.",
      },
      query: base,
    };
  }
  const page = Number(rawPage);
  if (page > MAX_PAGE) {
    return {
      ok: false,
      error: {
        code: "page_out_of_range",
        message: `Search can show the first ${MAX_PAGE * PAGE_SIZE} results (${MAX_PAGE} pages). Try a narrower search.`,
      },
      query: base,
    };
  }
  return { ok: true, query: { ...base, page } };
}

/** Fields searched by keyword, weighted toward title and artist. */
const KEYWORD_FIELDS = [
  "title^3",
  "artist_title^2",
  "artist_display",
  "term_titles",
  "subject_titles",
  "style_titles",
  "classification_titles",
  "place_of_origin",
];

/**
 * The `params` object for GET /artworks/search. A `multi_match` treats the keyword as
 * plain text (no query syntax), and `cross_fields` lets "monet water lilies" match an
 * artist in one field and a title in another. Checked against the live API.
 */
export function buildSearchRequest(
  query: SearchQuery,
): Record<string, unknown> {
  const filter: unknown[] = [
    { term: { is_public_domain: true } },
    { exists: { field: "image_id" } },
  ];
  const typeId = ARTWORK_TYPES.find((t) => t.slug === query.type)?.id;
  if (typeId !== undefined) filter.push({ term: { artwork_type_id: typeId } });

  const bool: Record<string, unknown> = { filter };
  if (query.q) {
    bool.must = [
      {
        multi_match: {
          query: query.q,
          type: "cross_fields",
          fields: KEYWORD_FIELDS,
          operator: "and",
        },
      },
    ];
  } else {
    // With no keyword, lead with the works the museum itself highlights.
    bool.should = [{ term: { is_boosted: true } }];
  }

  return {
    query: { bool },
    fields: ARTWORK_FIELDS.join(","),
    limit: PAGE_SIZE,
    page: query.page,
  };
}

/** Path and query string for a search request (relative to the API base). */
export function searchPath(query: SearchQuery): string {
  return `/artworks/search?params=${encodeURIComponent(JSON.stringify(buildSearchRequest(query)))}`;
}

export function artworkPath(id: number): string {
  return `/artworks/${id}?fields=${ARTWORK_FIELDS.join(",")}`;
}

export function artworksByIdsPath(ids: readonly number[]): string {
  return `/artworks?ids=${ids.join(",")}&limit=${ids.length}&fields=${ARTWORK_FIELDS.join(",")}`;
}

/** Positive integer id from a route segment or query value, or null. */
export function parseArtworkId(
  value: string | undefined | null,
): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}
