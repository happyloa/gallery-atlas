import { afterEach, describe, expect, it, vi } from "vitest";
import { getArtist, searchArtworks } from "@/lib/artic/artworks";
import { MAX_REQUEST_PATH } from "@/lib/artic/config";
import {
  colorCountsFromHues,
  colorForHsl,
  eraForYear,
} from "@/lib/artic/filters";
import {
  cleanParagraphs,
  cleanTags,
  toArtist,
  toArtworkDetail,
} from "@/lib/artic/mapper";
import { getCollectionOverview } from "@/lib/artic/overview";
import {
  buildSearchRequest,
  huesPath,
  overviewPath,
  parseSearchQuery,
  searchPath,
} from "@/lib/artic/queries";
import {
  EMPTY_QUERY,
  hasFilters,
  toSearchParams,
} from "@/lib/artic/search-url";
import {
  detailResponse,
  fastRetry,
  IIIF_URL,
  jsonResponse,
  listResponse,
  rawArtwork,
} from "../fixtures/aic";

type Bool = { filter: unknown[]; must_not?: unknown[] };
const boolOf = (body: Record<string, unknown>) =>
  (body.query as { bool: Bool }).bool;

describe("parseSearchQuery: era, colour and tags", () => {
  it("accepts known eras and colours and exact tags", () => {
    const result = parseSearchQuery(
      new URLSearchParams(
        "era=1800s&color=blue&style=Impressionism&subject=landscape&theme=Essentials",
      ),
    );
    expect(result.query).toEqual({
      ...EMPTY_QUERY,
      era: "1800s",
      color: "blue",
      style: "Impressionism",
      subject: "landscape",
      theme: "Essentials",
    });
  });

  it("ignores unknown eras and colours, and caps tag length", () => {
    const result = parseSearchQuery({
      era: "jurassic",
      color: "chartreuse",
      style: `  ${"x".repeat(200)}  `,
    });
    expect(result.query.era).toBeNull();
    expect(result.query.color).toBeNull();
    expect(result.query.style).toHaveLength(60);
  });

  it("round-trips through the URL and knows when anything is set", () => {
    const query = { ...EMPTY_QUERY, color: "red" as const, page: 2 };
    expect(toSearchParams(query).toString()).toBe("color=red&page=2");
    expect(hasFilters(query)).toBe(true);
    expect(hasFilters(EMPTY_QUERY)).toBe(false);
  });
});

describe("buildSearchRequest filters", () => {
  it("adds an era range, colour bounds and an exact tag", () => {
    const bool = boolOf(
      buildSearchRequest({
        ...EMPTY_QUERY,
        era: "1400-1599",
        color: "blue",
        style: "Impressionism",
      }),
    );
    expect(bool.filter).toContainEqual({
      range: { date_start: { gte: 1400, lt: 1600 } },
    });
    expect(bool.filter).toContainEqual({
      range: { "color.h": { gte: 195, lt: 255 } },
    });
    expect(bool.filter).toContainEqual({ range: { "color.s": { gte: 25 } } });
    expect(bool.filter).toContainEqual({
      term: { "style_titles.keyword": "Impressionism" },
    });
  });

  it("joins red's two hue ranges with a should", () => {
    const bool = boolOf(buildSearchRequest({ ...EMPTY_QUERY, color: "red" }));
    expect(bool.filter).toContainEqual({
      bool: {
        should: [
          { range: { "color.h": { gte: 345, lt: 361 } } },
          { range: { "color.h": { gte: 0, lt: 15 } } },
        ],
        minimum_should_match: 1,
      },
    });
  });

  it("scopes to an artist, leaves a work out and sets the size", () => {
    const body = buildSearchRequest(EMPTY_QUERY, {
      artistId: 40810,
      excludeId: 27992,
      limit: 4,
    });
    expect(boolOf(body).filter).toContainEqual({ term: { artist_id: 40810 } });
    expect(boolOf(body).must_not).toEqual([{ term: { id: 27992 } }]);
    expect(body.limit).toBe(4);
  });

  it("keeps the overview and colour requests under the API's URL limit", () => {
    expect(overviewPath().length).toBeLessThan(MAX_REQUEST_PATH);
    expect(huesPath().length).toBeLessThan(MAX_REQUEST_PATH);
    const typical = searchPath({
      ...EMPTY_QUERY,
      q: "water lilies",
      type: "painting",
      era: "1800s",
      color: "red",
      style: "Japanese (culture or style)",
    });
    expect(typical.length).toBeLessThan(MAX_REQUEST_PATH);
  });
});

describe("searchArtworks URL guard", () => {
  it("refuses a search too long for the museum's CDN without calling it", async () => {
    const fetchImpl = vi.fn();
    const query = {
      ...EMPTY_QUERY,
      q: "畫".repeat(100),
      style: "風".repeat(60),
      subject: "景".repeat(60),
      color: "red" as const,
    };
    await expect(searchArtworks(query, { fetchImpl })).rejects.toMatchObject({
      code: "bad_request",
    });
    expect(fetchImpl).not.toHaveBeenCalled();
  });
});

describe("eraForYear and colorForHsl", () => {
  it("files years by their era, edges included", () => {
    expect(eraForYear(-300)).toBe("before-500");
    expect(eraForYear(1399)).toBe("500-1399");
    expect(eraForYear(1400)).toBe("1400-1599");
    expect(eraForYear(1884)).toBe("1800s");
    expect(eraForYear(1950)).toBe("1900s");
    expect(eraForYear(null)).toBeNull();
  });

  it("names vivid colours and leaves muted ones out", () => {
    expect(colorForHsl({ h: 359, s: 50, l: 40 })).toBe("red");
    expect(colorForHsl({ h: 5, s: 50, l: 40 })).toBe("red");
    expect(colorForHsl({ h: 197, s: 41, l: 37 })).toBe("blue");
    expect(colorForHsl({ h: 300, s: 40, l: 50 })).toBe("violet");
    expect(colorForHsl({ h: 59, s: 12, l: 52 })).toBeNull();
    expect(colorForHsl({ h: 200, s: 60, l: 95 })).toBeNull();
  });

  it("sums hue buckets into colours", () => {
    const counts = colorCountsFromHues([
      { key: 0, doc_count: 10 },
      { key: 355, doc_count: 5 },
      { key: 200, doc_count: 7 },
      { key: 300, doc_count: 2 },
    ]);
    expect(counts.red).toBe(15);
    expect(counts.blue).toBe(7);
    expect(counts.violet).toBe(2);
    expect(counts.green).toBe(0);
  });
});

describe("detail extras", () => {
  const detail = (extra: Record<string, unknown>) =>
    toArtworkDetail(rawArtwork(extra), IIIF_URL);

  it("maps tags, colour, era, artist and where it hangs", () => {
    const artwork = detail({
      artist_id: 40810,
      date_start: 1884,
      color: { h: 197, s: 41, l: 37, percentage: 0.1 },
      style_titles: ["Impressionism", "impressionism", 42, " Pointillism "],
      subject_titles: ["landscape"],
      theme_titles: null,
      is_on_view: true,
      gallery_title: "Gallery 240",
    });
    expect(artwork).toMatchObject({
      artistId: 40810,
      era: "1800s",
      dominantColor: { css: "hsl(197 41% 37%)", slug: "blue" },
      tags: {
        style: ["Impressionism", "Pointillism"],
        subject: ["landscape"],
        theme: [],
      },
      onView: { gallery: "Gallery 240" },
    });
  });

  it("drops a malformed extra on its own and keeps the work", () => {
    const artwork = detail({ artist_id: "forty", color: { h: "red" } });
    expect(artwork).not.toBeNull();
    expect(artwork?.artistId).toBeNull();
    expect(artwork?.dominantColor).toBeNull();
    expect(artwork?.onView).toBeNull();
  });

  it("splits the object record into lines and caps very long ones", () => {
    expect(cleanParagraphs("Line one\n\n  Line   two  ")).toEqual([
      "Line one",
      "Line two",
    ]);
    const long = cleanParagraphs(Array(200).fill("x".repeat(100)).join("\n"));
    expect(long?.join("").length).toBeLessThanOrEqual(6100);
    expect(long?.at(-1)?.endsWith("…")).toBe(true);
    expect(cleanParagraphs("   ")).toBeNull();
  });

  it("caps the number of tags", () => {
    expect(cleanTags(["a", "b", "c"], 2)).toEqual(["a", "b"]);
  });
});

describe("artists", () => {
  it("maps an artist and rejects a nameless record", () => {
    expect(
      toArtist({
        id: 40810,
        title: "Georges Seurat",
        birth_date: 1859,
        death_date: 1891,
        description: "<p>Painter of <em>dots</em>.</p>",
      }),
    ).toMatchObject({
      id: 40810,
      name: "Georges Seurat",
      birthYear: 1859,
      deathYear: 1891,
      sourceUrl: "https://www.artic.edu/artists/40810",
    });
    expect(toArtist({ id: 1, title: "  " })).toBeNull();
  });

  it("reports a missing artist as not found", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse({ error: "not found" }, { status: 404 }),
    );
    await expect(getArtist(1, { fetchImpl, ...fastRetry })).resolves.toEqual({
      status: "not_found",
    });
  });

  it("reads an artist record", async () => {
    const fetchImpl = vi.fn(async () =>
      jsonResponse(detailResponse({ id: 40810, title: "Georges Seurat" })),
    );
    const lookup = await getArtist(40810, { fetchImpl, ...fastRetry });
    expect(lookup).toMatchObject({
      status: "ok",
      artist: { name: "Georges Seurat" },
    });
  });
});

describe("getCollectionOverview", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("combines counts, colour totals and covers", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: string | URL) => {
        const url = String(input);
        if (url.includes("histogram"))
          return jsonResponse({
            aggregations: {
              hues: { buckets: [{ key: 200, doc_count: 9 }] },
            },
          });
        if (url.includes("aggs"))
          return jsonResponse({
            pagination: { total: 62000 },
            aggregations: {
              entrances: { buckets: { impressionism: { doc_count: 179 } } },
              eras: { buckets: [{ key: "1800s", doc_count: 25000 }] },
            },
          });
        return jsonResponse(listResponse([rawArtwork({ id: 16568 })]));
      }),
    );
    const overview = await getCollectionOverview();
    expect(overview?.total).toBe(62000);
    expect(overview?.entrances.impressionism).toMatchObject({ count: 179 });
    expect(overview?.entrances.impressionism.cover?.id).toBe(16568);
    expect(overview?.entrances.icons).toEqual({ count: 0, cover: null });
    expect(overview?.eras["1800s"]).toBe(25000);
    expect(overview?.colors?.blue).toBe(9);
  });

  it("gives up quietly when the counts can't be read", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({ unexpected: true })),
    );
    await expect(getCollectionOverview()).resolves.toBeNull();
  });
});
