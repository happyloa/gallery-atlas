/**
 * Offline stand-in for the AIC API, used ONLY when AIC_FIXTURES=1 outside production
 * (end-to-end tests, offline development). It answers the same paths aicGet builds, from
 * the dated snapshot in lib/fixtures, plus one non-public-domain record for the
 * "restricted" path. Production builds never enable it (see isFixtureMode).
 */
import { previewArtworks } from "@/lib/fixtures/preview-artworks";
import { ARTWORK_TYPES } from "./config";

const IIIF_URL = "https://www.artic.edu/iiif/2";

/** Fixture mode is opt-in and never available in a production build. */
export function isFixtureMode(): boolean {
  if (typeof process === "undefined") return false;
  return (
    process.env.AIC_FIXTURES === "1" && process.env.NODE_ENV !== "production"
  );
}

type Raw = Record<string, unknown> & {
  id: number;
  title: string;
  artist_title: string | null;
  artwork_type_title: string | null;
};

const RECORDS: Raw[] = [
  ...previewArtworks.map((artwork): Raw => {
    const imageId = /\/iiif\/2\/([^/]+)\//.exec(artwork.image.src)?.[1] ?? null;
    return {
      id: artwork.id,
      title: artwork.title,
      artist_title: artwork.artist,
      artist_display: artwork.artist,
      date_display: artwork.dateDisplay,
      artwork_type_title: artwork.type,
      medium_display: artwork.medium,
      dimensions: artwork.dimensions,
      place_of_origin: artwork.origin,
      image_id: imageId,
      is_public_domain: true,
      thumbnail: {
        width: Math.round(artwork.image.aspectRatio * 1000),
        height: 1000,
        alt_text: artwork.image.alt,
      },
      credit_line: artwork.creditLine,
      description:
        artwork.id === 27992
          ? "<p>Fixture description for <em>A Sunday on La Grande Jatte</em>.</p><p>Second paragraph.</p>"
          : null,
    };
  }),
  {
    id: 111628,
    title: "Nighthawks",
    artist_title: "Edward Hopper",
    artwork_type_title: "Painting",
    image_id: "831a05de-d3f6-f4fa-a460-23008dd58dda",
    is_public_domain: false,
  },
];

const CONFIG = { iiif_url: IIIF_URL, website_url: "https://www.artic.edu" };

class FixtureNotFound extends Error {}

function select(record: Raw, fields: string[] | null): Record<string, unknown> {
  if (!fields) return record;
  return Object.fromEntries(
    fields.map((field) => [field, record[field] ?? null]),
  );
}

function fieldsOf(url: URL): string[] | null {
  return url.searchParams.get("fields")?.split(",") ?? null;
}

function search(url: URL): unknown {
  const params = JSON.parse(url.searchParams.get("params") ?? "{}") as {
    query?: {
      bool?: {
        must?: Array<{ multi_match?: { query?: string } }>;
        filter?: Array<{ term?: { artwork_type_id?: number } }>;
      };
    };
    fields?: string;
    limit?: number;
    page?: number;
  };
  const keyword =
    params.query?.bool?.must?.[0]?.multi_match?.query
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean) ?? [];
  const typeId = params.query?.bool?.filter?.find(
    (f) => f.term?.artwork_type_id !== undefined,
  )?.term?.artwork_type_id;
  const typeLabel = ARTWORK_TYPES.find((t) => t.id === typeId)?.label;

  const matches = RECORDS.filter((record) => {
    if (record.is_public_domain !== true || !record.image_id) return false;
    if (typeLabel && record.artwork_type_title !== typeLabel) return false;
    const haystack =
      `${record.title} ${record.artist_title ?? ""}`.toLowerCase();
    return keyword.every((word) => haystack.includes(word));
  });

  const limit = params.limit ?? 12;
  const page = params.page ?? 1;
  const fields = params.fields?.split(",") ?? null;
  return {
    pagination: {
      total: matches.length,
      limit,
      offset: (page - 1) * limit,
      total_pages: Math.ceil(matches.length / limit),
      current_page: page,
    },
    data: matches
      .slice((page - 1) * limit, page * limit)
      .map((record) => select(record, fields)),
    config: CONFIG,
  };
}

/** Answers a path under the API base, the way the real API would. */
export function fixtureResponse(path: string): unknown {
  const url = new URL(path, "https://fixtures.invalid/");
  if (url.pathname === "/artworks/search") return search(url);

  if (url.pathname === "/artworks") {
    const ids = (url.searchParams.get("ids") ?? "").split(",").map(Number);
    const data = RECORDS.filter((record) => ids.includes(record.id)).map(
      (record) => select(record, fieldsOf(url)),
    );
    return {
      pagination: { total: data.length, limit: data.length },
      data,
      config: CONFIG,
    };
  }

  const detail = /^\/artworks\/(\d+)$/.exec(url.pathname);
  if (detail) {
    const record = RECORDS.find((r) => r.id === Number(detail[1]));
    if (!record) throw new FixtureNotFound();
    return { data: select(record, fieldsOf(url)), config: CONFIG };
  }
  throw new FixtureNotFound();
}

export function isFixtureNotFound(error: unknown): boolean {
  return error instanceof FixtureNotFound;
}
