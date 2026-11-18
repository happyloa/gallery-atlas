/**
 * Builders for AIC API payloads, shaped like real responses (checked against the live API
 * on 2026-11-18). Each builder takes overrides so a test states only what it cares about.
 */

export const IIIF_URL = "https://www.artic.edu/iiif/2";
export const CONFIG = {
  iiif_url: IIIF_URL,
  website_url: "https://www.artic.edu",
};

/** A Sunday on La Grande Jatte: public domain, with an image. */
export function rawArtwork(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    id: 27992,
    title: "A Sunday on La Grande Jatte — 1884",
    artist_title: "Georges Seurat",
    artist_display: "Georges Seurat\nFrench, 1859–1891",
    date_display: "1884–86, border added 1888–89",
    artwork_type_title: "Painting",
    medium_display: "Oil on canvas",
    dimensions: "207.5 × 308.1 cm (81 3/4 × 121 1/4 in.)",
    place_of_origin: "France",
    image_id: "2d484387-2509-5e8e-2c43-22f9981972eb",
    is_public_domain: true,
    thumbnail: {
      lqip: "data:image/gif;base64,R0lGODlhCAAFAPUAAE1WUA==",
      width: 9310,
      height: 6237,
      alt_text:
        "Large painting of people in a crowded park, brushstrokes are dots.",
    },
    credit_line: "Helen Birch Bartlett Memorial Collection",
    ...overrides,
  };
}

/** Nighthawks: has an image id but is NOT public domain. */
export function restrictedArtwork(
  overrides: Record<string, unknown> = {},
): Record<string, unknown> {
  return rawArtwork({
    id: 111628,
    title: "Nighthawks",
    artist_title: "Edward Hopper",
    image_id: "831a05de-d3f6-f4fa-a460-23008dd58dda",
    is_public_domain: false,
    ...overrides,
  });
}

export function searchResponse(
  data: unknown[],
  pagination: Partial<{
    total: number;
    limit: number;
    current_page: number;
    total_pages: number;
  }> = {},
  config: unknown = CONFIG,
) {
  const limit = pagination.limit ?? 12;
  const total = pagination.total ?? data.length;
  return {
    preference: null,
    pagination: {
      total,
      limit,
      offset: ((pagination.current_page ?? 1) - 1) * limit,
      total_pages: pagination.total_pages ?? Math.ceil(total / limit),
      current_page: pagination.current_page ?? 1,
    },
    data,
    info: { license_text: "…", version: "1.16" },
    config,
  };
}

export function detailResponse(data: unknown, config: unknown = CONFIG) {
  return { data, info: { version: "1.16" }, config };
}

export function listResponse(data: unknown[], config: unknown = CONFIG) {
  return {
    pagination: { total: data.length, limit: data.length },
    data,
    info: { version: "1.16" },
    config,
  };
}

export function jsonResponse(body: unknown, init: ResponseInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { "Content-Type": "application/json" },
    ...init,
  });
}

/** Options that make retries instant and deterministic. */
export const fastRetry = { sleep: async () => {}, random: () => 0.5 };
