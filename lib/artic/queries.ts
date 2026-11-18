/**
 * Whitelisted search parameters and the fixed query sent upstream.
 *
 * Visitors control a keyword (≤ 100 chars), a type, era and colour from fixed lists, one
 * style, subject or theme tag (≤ 60 chars, matched exactly), and a page within the API's
 * 1,000-result window. They never supply a URL or query DSL: every value lands in a fixed
 * clause as plain JSON data.
 */
import { z } from "zod";
import {
  ARTWORK_DETAIL_FIELDS,
  ARTWORK_FIELDS,
  ARTWORK_TYPES,
  COLORS,
  ENTRANCES,
  ERAS,
  MAX_PAGE,
  MAX_QUERY_LENGTH,
  MAX_TAG_LENGTH,
  PAGE_SIZE,
  PLACE_FIELD,
  SANE_YEARS,
  SORTS,
} from "./config";
import type { ArtworkTypeSlug, ColorSlug, EraSlug, SortSlug } from "./config";
import {
  colorClauses,
  DISPLAYABLE,
  eraClause,
  tagClause,
  VIVID_CLAUSES,
} from "./filters";
import { EMPTY_QUERY } from "./search-url";
import type { SearchQuery } from "./search-url";

export type { SearchQuery } from "./search-url";
export { EMPTY_QUERY, searchHref, toSearchParams } from "./search-url";

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
const eraSchema = z.enum(ERAS.map((e) => e.slug) as [EraSlug, ...EraSlug[]]);
const colorSchema = z.enum(
  COLORS.map((c) => c.slug) as [ColorSlug, ...ColorSlug[]],
);
const sortSchema = z.enum(SORTS as unknown as [SortSlug, ...SortSlug[]]);
const pageSchema = z.string().regex(/^\d{1,6}$/);

/** Collapses whitespace and caps the keyword at the maximum length. */
export function normalizeKeyword(
  value: string | undefined,
  max: number = MAX_QUERY_LENGTH,
): string {
  if (!value) return "";
  // Turn control characters into spaces, then collapse whitespace.
  const cleaned = Array.from(value, (char) => {
    const code = char.codePointAt(0) ?? 0;
    return code < 0x20 || code === 0x7f ? " " : char;
  })
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  return Array.from(cleaned).slice(0, max).join("").trim();
}

export function parseSearchQuery(params: RawParams): SearchQueryResult {
  // Unknown types, eras and colours are ignored rather than rejected, so an old or
  // edited link still shows something.
  const pick = <T>(schema: z.ZodType<T>, key: string): T | null => {
    const result = schema.safeParse(first(params, key));
    return result.success ? result.data : null;
  };
  const tag = (key: string) =>
    normalizeKeyword(first(params, key), MAX_TAG_LENGTH) || null;
  const base: SearchQuery = {
    ...EMPTY_QUERY,
    q: normalizeKeyword(first(params, "q")),
    type: pick(typeSchema, "type"),
    era: pick(eraSchema, "era"),
    color: pick(colorSchema, "color"),
    style: tag("style"),
    subject: tag("subject"),
    theme: tag("theme"),
    place: tag("place"),
    sort: pick(sortSchema, "sort") ?? "relevance",
  };

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

export interface SearchScope {
  /** Only works by this artist (AIC agent id). */
  artistId?: number;
  /** Only works on view in this gallery of the museum. */
  galleryId?: number;
  /** Leave this work out, e.g. the one already on screen. */
  excludeId?: number;
  limit?: number;
}

/**
 * The `params` object for GET /artworks/search. A `multi_match` treats the keyword as
 * plain text (no query syntax), and `cross_fields` lets "monet water lilies" match an
 * artist in one field and a title in another. Checked against the live API.
 */
export function buildSearchRequest(
  query: SearchQuery,
  scope: SearchScope = {},
): Record<string, unknown> {
  const filter: unknown[] = [...DISPLAYABLE];
  const typeId = ARTWORK_TYPES.find((t) => t.slug === query.type)?.id;
  if (typeId !== undefined) filter.push({ term: { artwork_type_id: typeId } });
  if (query.era) filter.push(eraClause(query.era));
  if (query.color) filter.push(...colorClauses(query.color));
  if (query.style) filter.push(tagClause("style", query.style));
  if (query.subject) filter.push(tagClause("subject", query.subject));
  if (query.theme) filter.push(tagClause("theme", query.theme));
  if (query.place) filter.push({ term: { [PLACE_FIELD]: query.place } });
  if (query.sort !== "relevance")
    filter.push({
      range: { date_start: { gte: SANE_YEARS.from, lte: SANE_YEARS.to } },
    });
  if (scope.artistId !== undefined)
    filter.push({ term: { artist_id: scope.artistId } });
  if (scope.galleryId !== undefined)
    filter.push(
      { term: { gallery_id: scope.galleryId } },
      { term: { is_on_view: true } },
    );

  const bool: Record<string, unknown> = { filter };
  if (scope.excludeId !== undefined)
    bool.must_not = [{ term: { id: scope.excludeId } }];
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
    limit: scope.limit ?? PAGE_SIZE,
    page: query.page,
    ...(query.sort === "relevance"
      ? {}
      : { sort: [{ date_start: query.sort === "oldest" ? "asc" : "desc" }] }),
  };
}

function searchPathFor(params: Record<string, unknown>): string {
  return `/artworks/search?params=${encodeURIComponent(JSON.stringify(params))}`;
}

/** Path and query string for a search request (relative to the API base). */
export function searchPath(query: SearchQuery, scope?: SearchScope): string {
  return searchPathFor(buildSearchRequest(query, scope));
}

/**
 * Counts for the homepage: works under each curated entrance and in each era. One
 * request, no records (limit 0).
 */
export function overviewPath(): string {
  return searchPathFor({
    query: { bool: { filter: DISPLAYABLE } },
    limit: 0,
    aggs: {
      entrances: {
        filters: {
          filters: Object.fromEntries(
            ENTRANCES.map((e) => [e.slug, tagClause(e.kind, e.value)]),
          ),
        },
      },
      eras: {
        range: {
          field: "date_start",
          ranges: ERAS.map((e) => ({
            key: e.slug,
            ...(e.from != null ? { from: e.from } : {}),
            ...(e.to != null ? { to: e.to } : {}),
          })),
        },
      },
    },
  });
}

/**
 * Dominant-colour counts in 5° hue buckets, for vivid colours only. Kept apart from
 * overviewPath: a filters aggregation per colour made the URL too long for the API's CDN.
 */
export function huesPath(): string {
  return searchPathFor({
    query: { bool: { filter: [...DISPLAYABLE, ...VIVID_CLAUSES] } },
    limit: 0,
    aggs: { hues: { histogram: { field: "color.h", interval: 5 } } },
  });
}

/** Fields read from an artist (agent) record. */
export const ARTIST_FIELDS = [
  "id",
  "title",
  "birth_date",
  "death_date",
  "description",
] as const;

export function artistPath(id: number): string {
  return `/agents/${id}?fields=${ARTIST_FIELDS.join(",")}`;
}

export function artworkPath(id: number, detail = false): string {
  return `/artworks/${id}?fields=${(detail ? ARTWORK_DETAIL_FIELDS : ARTWORK_FIELDS).join(",")}`;
}

export function artworksByIdsPath(ids: readonly number[]): string {
  return `/artworks?ids=${ids.join(",")}&limit=${ids.length}&fields=${ARTWORK_FIELDS.join(",")}`;
}

/** Positive integer id from a route segment or query value, or null. */
export function parseId(
  value: string | undefined | null,
): number | null {
  if (!value || !/^\d{1,9}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 ? id : null;
}

/** Artwork ids follow the same rule as any other record id. */
export const parseArtworkId = parseId;

/** Gallery ids run into the billions (e.g. 2147478672), past the 9-digit artwork rule. */
export function parseGalleryId(value: string | undefined | null): number | null {
  if (!value || !/^\d{1,10}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && id <= 2_147_483_647 ? id : null;
}
