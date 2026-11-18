/**
 * Offline stand-in for the AIC API, used ONLY when AIC_FIXTURES=1 outside production
 * (end-to-end tests, offline development). It answers the same paths aicGet builds, from
 * the dated snapshot in lib/fixtures, plus one non-public-domain record for the
 * "restricted" path. Production builds never enable it (see isFixtureMode).
 *
 * Searches understand the clauses this site sends (terms, ranges, nested bools) and the
 * three aggregation kinds it asks for, so filters and homepage counts work offline too.
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

/** Tags, dates and colours copied from the live records (2026-11-18), trimmed. */
const EXTRAS: Record<number, Record<string, unknown>> = {
  27992: {
    artist_id: 40810,
    date_start: 1884,
    color: { h: 59, s: 12, l: 52 },
    style_titles: [
      "Pointillism",
      "19th century",
      "Post-Impressionism",
      "Impressionism",
    ],
    subject_titles: ["leisure", "landscape", "dogs"],
    theme_titles: ["Art Institute Icons", "Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 240",
    inscriptions: "Inscribed lower right: Seurat",
    provenance_text:
      "The artist; given to his mother, Paris, 1891.\nSold to Lucie Cousturier, Paris, 1900.",
    exhibition_history: "Paris, Société des Artistes Indépendants, 1886.",
    publication_history: "Jules Christophe, Georges Seurat (Paris, 1890).",
  },
  20684: {
    artist_id: 3829,
    date_start: 1877,
    color: { h: 205, s: 14, l: 51 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["urban life"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 201",
  },
  28560: {
    artist_id: 40610,
    date_start: 1889,
    color: { h: 40, s: 65, l: 34 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["interiors"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 241",
  },
  16568: {
    artist_id: 35809,
    date_start: 1906,
    color: { h: 197, s: 41, l: 37 },
    style_titles: ["Impressionism", "20th Century"],
    subject_titles: ["landscapes"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 243",
  },
  64818: {
    artist_id: 35809,
    date_start: 1890,
    color: { h: 52, s: 47, l: 38 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["seasons"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 243",
  },
  14655: {
    artist_id: 36351,
    date_start: 1881,
    color: { h: 2, s: 55, l: 52 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["sisters"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 201",
  },
  111436: {
    artist_id: 40482,
    date_start: 1887,
    color: { h: 94, s: 4, l: 55 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["still life"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 248",
  },
  80607: {
    artist_id: 40610,
    date_start: 1887,
    color: { h: 40, s: 16, l: 30 },
    style_titles: ["Post-Impressionism", "19th century"],
    subject_titles: ["portraits"],
    theme_titles: ["Essentials"],
    is_on_view: true,
    gallery_title: "Gallery 241",
  },
  24645: {
    artist_id: 31492,
    date_start: 1826,
    color: { h: 235, s: 47, l: 50 },
    style_titles: ["Japanese (culture or style)", "19th century"],
    subject_titles: ["waves"],
    theme_titles: ["Essentials"],
    is_on_view: false,
  },
  16571: {
    artist_id: 35809,
    date_start: 1877,
    color: { h: 6, s: 53, l: 34 },
    style_titles: ["Impressionism", "19th century"],
    subject_titles: ["trains"],
    theme_titles: [],
    is_on_view: false,
  },
};

const AGENTS: Record<number, Record<string, unknown>> = {
  40810: {
    id: 40810,
    title: "Georges Seurat",
    birth_date: 1859,
    death_date: 1891,
    description:
      "<p>Fixture biography for <em>Georges Seurat</em>.</p><p>Second paragraph.</p>",
  },
  40610: {
    id: 40610,
    title: "Vincent van Gogh",
    birth_date: 1853,
    death_date: 1890,
    description: null,
  },
  35809: {
    id: 35809,
    title: "Claude Monet",
    birth_date: 1840,
    death_date: 1926,
    description: null,
  },
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
      ...EXTRAS[artwork.id],
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

/** A record's value for a query field: "color.h", "style_titles.keyword", "artist_id"… */
function valueOf(record: Raw, field: string): unknown {
  const name = field.replace(/\.keyword$/, "");
  if (name.startsWith("color.")) {
    const color = record.color as Record<string, number> | undefined;
    return color?.[name.slice("color.".length)];
  }
  if (name === "artwork_type_id") {
    return ARTWORK_TYPES.find((t) => t.label === record.artwork_type_title)?.id;
  }
  return record[name];
}

type Clause = Record<string, unknown>;

/** Evaluates one query clause against a record, for the clause shapes this site sends. */
function matches(record: Raw, clause: Clause): boolean {
  if ("term" in clause) {
    const [field, expected] = Object.entries(clause.term as Clause)[0] ?? [];
    if (field === undefined) return true;
    const actual = valueOf(record, field);
    return Array.isArray(actual)
      ? actual.includes(expected)
      : actual === expected;
  }
  if ("exists" in clause) {
    const field = (clause.exists as { field: string }).field;
    return valueOf(record, field) != null;
  }
  if ("range" in clause) {
    const [field, bounds] = Object.entries(clause.range as Clause)[0] ?? [];
    if (field === undefined) return true;
    const value = valueOf(record, field);
    if (typeof value !== "number") return false;
    const b = bounds as {
      gte?: number;
      gt?: number;
      lt?: number;
      lte?: number;
    };
    return (
      (b.gte === undefined || value >= b.gte) &&
      (b.gt === undefined || value > b.gt) &&
      (b.lt === undefined || value < b.lt) &&
      (b.lte === undefined || value <= b.lte)
    );
  }
  if ("bool" in clause) {
    const bool = clause.bool as {
      filter?: Clause[];
      must?: Clause[];
      should?: Clause[];
      must_not?: Clause[];
    };
    return (
      (bool.filter ?? []).every((c) => matches(record, c)) &&
      (bool.must_not ?? []).every((c) => !matches(record, c)) &&
      (!bool.should?.length || bool.should.some((c) => matches(record, c)))
    );
  }
  return true;
}

interface SearchParams {
  query?: {
    bool?: {
      must?: Array<{ multi_match?: { query?: string } }>;
      filter?: Clause[];
      must_not?: Clause[];
    };
  };
  aggs?: Record<string, Clause>;
  fields?: string;
  limit?: number;
  page?: number;
}

function aggregate(records: Raw[], aggs: Record<string, Clause>) {
  const result: Record<string, unknown> = {};
  for (const [name, agg] of Object.entries(aggs)) {
    if ("filters" in agg) {
      const filters = (agg.filters as { filters: Record<string, Clause> })
        .filters;
      result[name] = {
        buckets: Object.fromEntries(
          Object.entries(filters).map(([key, clause]) => [
            key,
            { doc_count: records.filter((r) => matches(r, clause)).length },
          ]),
        ),
      };
    } else if ("range" in agg) {
      const { field, ranges } = agg.range as {
        field: string;
        ranges: { key: string; from?: number; to?: number }[];
      };
      result[name] = {
        buckets: ranges.map((range) => ({
          key: range.key,
          doc_count: records.filter((r) =>
            matches(r, {
              range: { [field]: { gte: range.from, lt: range.to } },
            }),
          ).length,
        })),
      };
    } else if ("histogram" in agg) {
      const { field, interval } = agg.histogram as {
        field: string;
        interval: number;
      };
      const counts = new Map<number, number>();
      for (const record of records) {
        const value = valueOf(record, field);
        if (typeof value !== "number") continue;
        const key = Math.floor(value / interval) * interval;
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
      result[name] = {
        buckets: [...counts.entries()]
          .sort(([a], [b]) => a - b)
          .map(([key, doc_count]) => ({ key, doc_count })),
      };
    }
  }
  return result;
}

function search(url: URL): unknown {
  const params = JSON.parse(
    url.searchParams.get("params") ?? "{}",
  ) as SearchParams;
  const bool = params.query?.bool;
  const keyword =
    bool?.must?.[0]?.multi_match?.query
      ?.toLowerCase()
      .split(/\s+/)
      .filter(Boolean) ?? [];

  const found = RECORDS.filter((record) => {
    if (
      !matches(record, {
        bool: { filter: bool?.filter, must_not: bool?.must_not },
      })
    )
      return false;
    const haystack =
      `${record.title} ${record.artist_title ?? ""}`.toLowerCase();
    return keyword.every((word) => haystack.includes(word));
  });

  const limit = params.limit ?? 12;
  const page = params.page ?? 1;
  const fields = params.fields?.split(",") ?? null;
  return {
    pagination: {
      total: found.length,
      limit,
      offset: (page - 1) * limit,
      total_pages: limit > 0 ? Math.ceil(found.length / limit) : 0,
      current_page: page,
    },
    data:
      limit > 0
        ? found
            .slice((page - 1) * limit, page * limit)
            .map((record) => select(record, fields))
        : [],
    ...(params.aggs ? { aggregations: aggregate(found, params.aggs) } : {}),
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

  const agent = /^\/agents\/(\d+)$/.exec(url.pathname);
  if (agent) {
    const record = AGENTS[Number(agent[1])];
    if (!record) throw new FixtureNotFound();
    return { data: record, config: CONFIG };
  }
  throw new FixtureNotFound();
}

export function isFixtureNotFound(error: unknown): boolean {
  return error instanceof FixtureNotFound;
}
