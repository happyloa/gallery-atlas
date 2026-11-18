import { afterEach, describe, expect, it, vi } from "vitest";
import {
  dayNumber,
  exhibitionStatus,
  getRandomArtworkId,
  getSounds,
  getSuggestions,
  getWorkOfTheDayId,
  plainTitle,
  toExhibition,
  toSound,
} from "@/lib/artic/museum";
import {
  buildSearchRequest,
  parseGalleryId,
  parseSearchQuery,
} from "@/lib/artic/queries";
import { EMPTY_QUERY, toSearchParams } from "@/lib/artic/search-url";
import { importExhibition, EMPTY_COLLECTION } from "@/lib/collections/schema";
import { parseSharedExhibition } from "@/lib/collections/share";
import { placeByKey } from "@/lib/geo/places";
import { MAP_HEIGHT, MAP_WIDTH, project } from "@/lib/geo/projection";
import { formatCount } from "@/lib/i18n/format";
import { jsonResponse } from "../fixtures/aic";

afterEach(() => {
  vi.unstubAllGlobals();
});

describe("audio", () => {
  it("names numbered audio guide stops and strips markup from talks", () => {
    expect(
      toSound({
        id: "a",
        title: "Audio stop 781.mp3",
        content: "https://www.artic.edu/assets/a",
      }),
    ).toEqual({
      id: "a",
      title: "Audio stop 781",
      stop: 781,
      src: "https://www.artic.edu/assets/a",
    });
    expect(
      toSound({
        id: "b",
        title: "Audio Lecture: <em>La Grande Jatte</em>",
        content: "https://www.artic.edu/assets/b",
      })?.title,
    ).toBe("Audio Lecture: La Grande Jatte");
  });

  it("only plays recordings hosted on artic.edu over https", () => {
    for (const content of [
      "http://www.artic.edu/assets/x",
      "https://evil.example/assets/x",
      "javascript:alert(1)",
      null,
    ]) {
      expect(toSound({ id: "x", title: "t", content })).toBeNull();
    }
  });

  it("gives an empty list when the museum can't be reached", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, { status: 500 })),
    );
    await expect(
      getSounds(["d9683532-66fd-67c3-5588-021527d115af"]),
    ).resolves.toEqual([]);
    await expect(getSounds([])).resolves.toEqual([]);
  });
});

describe("museum exhibitions", () => {
  const raw = {
    id: 1,
    title: "Zurbarán: <em>Divine</em> Light",
    short_description: "<p>About fifty works.</p>",
    web_url: "https://www.artic.edu/exhibitions/1/zurbaran",
    aic_start_at: "2027-02-28T00:00:00-06:00",
    aic_end_at: "2027-06-20T00:00:00-05:00",
    gallery_id: 7,
    gallery_title: "Regenstein Hall",
    artwork_ids: [5, 5, -1, "x", 6],
  };

  it("maps titles, dates, gallery and unique work ids", () => {
    expect(toExhibition(raw)).toMatchObject({
      id: 1,
      title: "Zurbarán: Divine Light",
      start: "2027-02-28",
      end: "2027-06-20",
      gallery: { id: 7, name: "Regenstein Hall" },
      artworkIds: [5, 6],
      sourceUrl: "https://www.artic.edu/exhibitions/1/zurbaran",
    });
  });

  it("falls back to the museum's own URL for an off-site link", () => {
    expect(
      toExhibition({ ...raw, web_url: "https://elsewhere.example/" })
        ?.sourceUrl,
    ).toBe("https://www.artic.edu/exhibitions/1");
  });

  it("says whether an exhibition is coming up, on or over", () => {
    const dates = { start: "2027-02-28", end: "2027-06-20" };
    expect(exhibitionStatus(dates, "2027-01-01")).toBe("upcoming");
    expect(exhibitionStatus(dates, "2027-03-01")).toBe("current");
    expect(exhibitionStatus(dates, "2027-06-21")).toBe("past");
    expect(
      exhibitionStatus({ start: null, end: null }, "2027-01-01"),
    ).toBeNull();
  });
});

describe("suggestions, random and daily picks", () => {
  it("cleans and de-duplicates suggestions and skips one-letter prefixes", async () => {
    const fetchMock = vi.fn(async () =>
      jsonResponse([
        "Claude Monet",
        "claude monet",
        42,
        "<em>Water</em> Lilies",
      ]),
    );
    vi.stubGlobal("fetch", fetchMock);
    await expect(getSuggestions("mo")).resolves.toEqual([
      "Claude Monet",
      "Water Lilies",
    ]);
    await expect(getSuggestions("m")).resolves.toEqual([]);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("picks the same highlight all day and another one the next day", async () => {
    const pages: number[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const params = JSON.parse(
          decodeURIComponent(String(url).split("params=")[1] ?? "{}"),
        ) as { limit?: number; page?: number; query?: unknown };
        expect(JSON.stringify(params.query)).toContain('"is_boosted":true');
        if (params.limit === 0)
          return jsonResponse({ pagination: { total: 228 }, data: [] });
        pages.push(params.page ?? 0);
        return jsonResponse({ data: [{ id: 1000 + (params.page ?? 0) }] });
      }),
    );
    const morning = await getWorkOfTheDayId(new Date("2026-11-18T01:00:00Z"));
    const night = await getWorkOfTheDayId(new Date("2026-11-18T23:00:00Z"));
    const tomorrow = await getWorkOfTheDayId(new Date("2026-11-19T12:00:00Z"));
    expect(morning).toBe(night);
    expect(tomorrow).not.toBe(morning);
    expect(pages.every((page) => page >= 1 && page <= 228)).toBe(true);
    expect(dayNumber(new Date("2026-11-18T23:59:59Z"))).toBe(
      dayNumber(new Date("2026-11-18T00:00:00Z")),
    );
  });

  it("picks a random work near a random point in the id range", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: string) => {
        const text = decodeURIComponent(String(url));
        if (text.includes('"gte"'))
          return jsonResponse({ data: [{ id: 15 }, { id: 16 }, { id: 17 }] });
        if (text.includes('"desc"'))
          return jsonResponse({ data: [{ id: 20 }] });
        return jsonResponse({ data: [{ id: 10 }] });
      }),
    );
    // Cursor 10 + floor(0.5 × 11) = 15, then the middle of [15, 16, 17].
    await expect(getRandomArtworkId(() => 0.5)).resolves.toBe(16);
    await expect(getRandomArtworkId(() => 0)).resolves.toBe(15);
  });

  it("gives no daily work when the API fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => jsonResponse({}, { status: 500 })),
    );
    await expect(getWorkOfTheDayId(new Date())).resolves.toBeNull();
  });
});

describe("place and order in search", () => {
  it("parses a place and an order, and keeps the default order out of URLs", () => {
    const { query } = parseSearchQuery({ place: "France", sort: "oldest" });
    expect(query).toMatchObject({ place: "France", sort: "oldest" });
    expect(toSearchParams(query).toString()).toBe("place=France&sort=oldest");
    expect(parseSearchQuery({ sort: "sideways" }).query.sort).toBe("relevance");
    expect(toSearchParams(EMPTY_QUERY).toString()).toBe("");
  });

  it("filters by place and sorts by date, ignoring placeholder years", () => {
    const body = buildSearchRequest({
      ...EMPTY_QUERY,
      place: "France",
      sort: "newest",
    });
    const filter = (body.query as { bool: { filter: unknown[] } }).bool.filter;
    expect(filter).toContainEqual({
      term: { "place_of_origin.keyword": "France" },
    });
    expect(filter).toContainEqual({
      range: { date_start: { gte: -8000, lte: 2030 } },
    });
    expect(body.sort).toEqual([{ date_start: "desc" }]);
    expect(buildSearchRequest(EMPTY_QUERY).sort).toBeUndefined();
  });

  it("scopes a search to works on view in one gallery", () => {
    const body = buildSearchRequest(EMPTY_QUERY, { galleryId: 2147478672 });
    const filter = (body.query as { bool: { filter: unknown[] } }).bool.filter;
    expect(filter).toContainEqual({ term: { gallery_id: 2147478672 } });
    expect(filter).toContainEqual({ term: { is_on_view: true } });
  });

  it("accepts the museum's 10-digit gallery ids, and nothing past 32 bits", () => {
    expect(parseGalleryId("2147478672")).toBe(2147478672);
    expect(parseGalleryId("2147483648")).toBeNull();
    expect(parseGalleryId("12a")).toBeNull();
  });
});

describe("shared exhibitions", () => {
  it("reads a title and unique, valid ids from a link", () => {
    expect(
      parseSharedExhibition({
        title: "  Evening   light ",
        ids: "27992,abc,27992,,28560",
      }),
    ).toEqual({ title: "Evening light", ids: [27992, 28560] });
    expect(parseSharedExhibition({ title: "", ids: "1" })).toBeNull();
    expect(parseSharedExhibition({ title: "x", ids: "" })).toBeNull();
    expect(
      parseSharedExhibition(
        new URLSearchParams(
          `title=x&ids=${Array.from({ length: 150 }, (_, i) => i + 1).join(",")}`,
        ),
      )?.ids,
    ).toHaveLength(100);
  });

  it("saves a shared exhibition in one write, at the top of the list", () => {
    const result = importExhibition(
      EMPTY_COLLECTION,
      "Evening light",
      [5, 5, 0, 6],
      "id-1",
      10,
    );
    expect(result).toMatchObject({
      ok: true,
      value: {
        id: "id-1",
        title: "Evening light",
        artworkIds: [5, 6],
        createdAt: 10,
      },
    });
    if (result.ok) expect(result.state.exhibitions[0]?.id).toBe("id-1");
  });
});

describe("map and wording helpers", () => {
  it("projects onto the map and finds places case-insensitively", () => {
    expect(project(84, -180)).toEqual({ x: 0, y: 0 });
    const { x, y } = project(-58, 180);
    expect(x).toBe(MAP_WIDTH);
    expect(y).toBeCloseTo(MAP_HEIGHT);
    expect(placeByKey("France")?.zh).toBe("法國");
    expect(placeByKey("atlantis")).toBeNull();
  });

  it("strips tags and decodes the common entities in titles", () => {
    expect(plainTitle("<em>A</em> &amp; B &quot;C&quot;")).toBe('A & B "C"');
    expect(plainTitle("   ")).toBeNull();
  });

  it("says one work, not one works", () => {
    expect(formatCount("1 work", "{count} works", 1)).toBe("1 work");
    expect(formatCount("1 work", "{count} works", 2, "2")).toBe("2 works");
  });
});
