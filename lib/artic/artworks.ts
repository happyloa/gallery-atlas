/**
 * Server-side reads used by pages and route handlers. Each returns domain types only,
 * already filtered to displayable public-domain works.
 */
import type { Artwork } from "@/lib/artwork/types";
import { aicGet, AicError, isAicError } from "./client";
import type { AicRequestOptions } from "./client";
import {
  MAX_IDS_PER_REQUEST,
  MAX_PAGE,
  MAX_SEARCH_RESULTS,
  REVALIDATE_ARTWORK,
  REVALIDATE_SEARCH,
} from "./config";
import { resolveIiifBase } from "./images";
import { toArtwork, toArtworks } from "./mapper";
import { artworkPath, artworksByIdsPath, searchPath } from "./queries";
import type { SearchQuery } from "./queries";
import {
  detailResponseSchema,
  listResponseSchema,
  searchResponseSchema,
} from "./schema";

type RequestOptions = Omit<AicRequestOptions, "revalidate">;

export interface SearchResult {
  artworks: Artwork[];
  /** Matching works upstream (public domain, with an image). */
  total: number;
  page: number;
  /** Pages a visitor can actually reach, capped by the 1,000-result window. */
  totalPages: number;
  /** True when more works match than the search window can show. */
  limited: boolean;
}

function invalid(what: string): AicError {
  return new AicError(
    "invalid_response",
    `The museum API sent an unexpected ${what} response.`,
  );
}

export async function searchArtworks(
  query: SearchQuery,
  options: RequestOptions = {},
): Promise<SearchResult> {
  const json = await aicGet(searchPath(query), {
    ...options,
    revalidate: REVALIDATE_SEARCH,
  });
  const parsed = searchResponseSchema.safeParse(json);
  if (!parsed.success) throw invalid("search");
  const { pagination, data, config } = parsed.data;
  const iiifBase = resolveIiifBase(config?.iiif_url);
  if (!iiifBase && data.length > 0)
    throw invalid("image configuration in the search");

  const reachable = Math.min(pagination.total, MAX_SEARCH_RESULTS);
  return {
    artworks: toArtworks(data, iiifBase),
    total: pagination.total,
    page: query.page,
    totalPages: Math.min(
      MAX_PAGE,
      Math.ceil(reachable / Math.max(1, pagination.limit)),
    ),
    limited: pagination.total > MAX_SEARCH_RESULTS,
  };
}

export type ArtworkLookup =
  | { status: "ok"; artwork: Artwork }
  | { status: "not_found" }
  /** The record exists but is not public domain or has no usable image. */
  | { status: "restricted" };

export async function getArtwork(
  id: number,
  options: RequestOptions = {},
): Promise<ArtworkLookup> {
  let json: unknown;
  try {
    json = await aicGet(artworkPath(id), {
      ...options,
      revalidate: REVALIDATE_ARTWORK,
    });
  } catch (error) {
    if (isAicError(error) && error.code === "not_found")
      return { status: "not_found" };
    throw error;
  }
  const parsed = detailResponseSchema.safeParse(json);
  if (!parsed.success) throw invalid("artwork");
  const artwork = toArtwork(
    parsed.data.data,
    resolveIiifBase(parsed.data.config?.iiif_url),
  );
  return artwork ? { status: "ok", artwork } : { status: "restricted" };
}

export interface ArtworksByIdsResult {
  /** Displayable works, in the order the ids were given. */
  artworks: Artwork[];
  /** Requested ids that are gone, not public domain, or lack an image. */
  unavailable: number[];
}

/**
 * Batch read for saved works. Ids are de-duplicated and fetched in chunks, one chunk at a
 * time, to stay gentle on the API's rate limit.
 */
export async function getArtworksByIds(
  ids: readonly number[],
  options: RequestOptions = {},
): Promise<ArtworksByIdsResult> {
  const unique = [...new Set(ids)];
  const found = new Map<number, Artwork>();
  for (let start = 0; start < unique.length; start += MAX_IDS_PER_REQUEST) {
    const chunk = unique.slice(start, start + MAX_IDS_PER_REQUEST);
    const json = await aicGet(artworksByIdsPath(chunk), {
      ...options,
      revalidate: REVALIDATE_ARTWORK,
    });
    const parsed = listResponseSchema.safeParse(json);
    if (!parsed.success) throw invalid("batch");
    for (const artwork of toArtworks(
      parsed.data.data,
      resolveIiifBase(parsed.data.config?.iiif_url),
    )) {
      found.set(artwork.id, artwork);
    }
  }
  const artworks: Artwork[] = [];
  const unavailable: number[] = [];
  for (const id of unique) {
    const artwork = found.get(id);
    if (artwork) artworks.push(artwork);
    else unavailable.push(id);
  }
  return { artworks, unavailable };
}
