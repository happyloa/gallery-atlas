import { describe, expect, it } from "vitest";
import { getProducts, toProduct } from "@/lib/artic/shop";
import {
  durationMinutes,
  museumClock,
  museumDay,
  openState,
  WEEKDAYS,
} from "@/lib/artic/events";
import type { MuseumHours } from "@/lib/artic/events";
import { isWorkFacet, parseFacetId } from "@/lib/artic/directory";
import { toArtist } from "@/lib/artic/mapper";
import { toMediaItem } from "@/lib/artic/media";
import {
  articUrl,
  cleanFileTitle,
  excerpt,
  imgixUrl,
  parseCatalogueEntry,
  parseCopy,
  parseRecordId,
  readableSlug,
  searchParamsFor,
  webUrl,
} from "@/lib/artic/records";
import { toSearchHit } from "@/lib/artic/site-search";
import { formatClock } from "@/lib/i18n/museum-time";
import { museumEn, museumZhTw } from "@/lib/i18n/dictionaries/museum";

const text = (paragraphs: { text: string }[][] | null) =>
  paragraphs?.map((runs) => runs.map((run) => run.text).join(""));

describe("parseCopy", () => {
  it("splits plain text on runs of three or more spaces", () => {
    expect(text(parseCopy(" First one.   Second  one.    Third."))).toEqual([
      "First one.",
      "Second one.",
      "Third.",
    ]);
  });

  it("reads HTML copy, leaving out the repeated title", () => {
    const parsed = parseCopy(
      "<h1>Title</h1><p>Body with <em>emphasis</em>.</p><h2>Part</h2><p>More.</p>",
    );
    expect(text(parsed)).toEqual(["Body with emphasis.", "Part", "More."]);
    expect(parsed?.[0]?.[1]).toEqual({ text: "emphasis", italic: true });
  });

  it("decodes entities and treats blank copy as missing", () => {
    expect(text(parseCopy("Fish &amp; chips"))).toEqual(["Fish & chips"]);
    expect(parseCopy("   ")).toBeNull();
    expect(parseCopy(null)).toBeNull();
  });
});

describe("parseCatalogueEntry", () => {
  const content =
    '<section class="osci-tk-epub-section tombstone" id="t">Water Lilies  \n1906\n\n</section>' +
    '<section class="osci-tk-epub-section curatorial_entry">One.\n\nTwo<sup>1</sup>.</section>' +
    '<section class="osci-tk-epub-section technical_report">Canvas.</section>' +
    '<section id="figures"></section>';

  it("keeps each block, with a heading where the museum names one", () => {
    const sections = parseCatalogueEntry(content);
    expect(sections.map((s) => s.heading)).toEqual([
      null,
      null,
      "Technical Report",
    ]);
    expect(text(sections[0]?.paragraphs ?? [])).toEqual([
      "Water Lilies",
      "1906",
    ]);
    expect(text(sections[1]?.paragraphs ?? [])).toEqual(["One.", "Two1."]);
  });

  it("gives nothing for empty content", () => {
    expect(parseCatalogueEntry(null)).toEqual([]);
    expect(parseCatalogueEntry('<section id="figures"></section>')).toEqual([]);
  });
});

describe("titles", () => {
  it("turns highlight slugs into titles", () => {
    expect(readableSlug("chicagos-home-for-the-holidays-105")).toBe(
      "Chicagos Home for the Holidays",
    );
    expect(readableSlug("Already a Title")).toBe("Already a Title");
  });

  it("tidies file names", () => {
    expect(cleanFileTitle("Garfield_Park_Art_Galleries_[5706]")).toBe(
      "Garfield Park Art Galleries",
    );
    expect(cleanFileTitle("AIC1896_first.pdf")).toBe("AIC1896 first");
  });

  it("cuts excerpts at a word", () => {
    const long = [[{ text: `${"word ".repeat(60)}end`, italic: false }]];
    const cut = excerpt(long, 40);
    expect(cut?.endsWith("…")).toBe(true);
    expect(cut?.length).toBeLessThanOrEqual(41);
    expect(excerpt(null)).toBeNull();
  });
});

describe("links", () => {
  it("accepts only the museum's own hosts as museum links", () => {
    expect(articUrl("https://shop.artic.edu/products/1")).toBe(
      "https://shop.artic.edu/products/1",
    );
    expect(articUrl("https://artic.edu.evil.example/x")).toBeNull();
    expect(articUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("javascript:alert(1)")).toBeNull();
    expect(webUrl("http://archive.artic.edu/cleo/")).toBe(
      "http://archive.artic.edu/cleo/",
    );
  });

  it("resizes museum images and keeps their proportions", () => {
    const url = new URL(
      imgixUrl(
        "https://artic-web.imgix.net/a/b.jpg?rect=0%2C0%2C9%2C9&w=1200&h=675",
        640,
      ) ?? "",
    );
    expect(url.searchParams.get("w")).toBe("640");
    expect(url.searchParams.get("h")).toBe("360");
    expect(url.searchParams.get("rect")).toBe("0,0,9,9");
    expect(imgixUrl("https://example.com/a.jpg", 640)).toBeNull();
    expect(imgixUrl("http://artic-web.imgix.net/a.jpg", 640)).toBeNull();
  });
});

describe("request building", () => {
  it("requires every keyword and leaves out what isn't asked for", () => {
    expect(searchParamsFor({ limit: 5 })).toEqual({ limit: 5 });
    expect(
      searchParamsFor({
        keyword: "monet",
        keywordFields: ["title"],
        filter: [{ term: { is_artist: true } }],
        limit: 5,
        page: 2,
      }),
    ).toEqual({
      query: {
        bool: {
          must: [
            {
              multi_match: {
                query: "monet",
                fields: ["title"],
                operator: "and",
              },
            },
          ],
          filter: [{ term: { is_artist: true } }],
        },
      },
      limit: 5,
      page: 2,
    });
  });

  it("accepts long catalogue ids and refuses anything else", () => {
    expect(parseRecordId("36744351949")).toBe(36744351949);
    expect(parseRecordId("0")).toBeNull();
    expect(parseRecordId("12a")).toBeNull();
    expect(parseRecordId("123456789012345")).toBeNull();
  });

  it("validates classification ids per facet", () => {
    expect(parseFacetId("styles", "TM-12045")).toBe("TM-12045");
    expect(parseFacetId("departments", "PC-10")).toBe("PC-10");
    expect(parseFacetId("styles", "TM-1;drop")).toBeNull();
    expect(parseFacetId("types", "23")).toBe("23");
    expect(parseFacetId("types", "TM-1")).toBeNull();
    expect(isWorkFacet("places")).toBe(false);
  });
});

describe("toArtist", () => {
  const artist = (extra: Record<string, unknown>) =>
    toArtist({ id: 1, title: "Georges Seurat", ...extra });

  it("links authority records only for well-formed ids", () => {
    expect(artist({ ulan_id: 500008873 })?.ulanUrl).toBe(
      "https://vocab.getty.edu/page/ulan/500008873",
    );
    expect(artist({ ulan_id: "../evil" })?.ulanUrl).toBeNull();
    expect(artist({ wikidata_id: "Q34013" })?.wikidataUrl).toBe(
      "https://www.wikidata.org/wiki/Q34013",
    );
    expect(artist({ wikidata_id: 34013 })?.wikidataUrl).toBe(
      "https://www.wikidata.org/wiki/Q34013",
    );
    expect(artist({ wikidata_id: "Qx" })?.wikidataUrl).toBeNull();
  });

  it("lists other names, without repeating the main one", () => {
    expect(
      artist({ alt_titles: ["Georges Seurat", "Georges Pierre Seurat"] })
        ?.altNames,
    ).toEqual(["Georges Pierre Seurat"]);
  });
});

describe("toSearchHit", () => {
  const hit = (api_model: string, extra: Record<string, unknown> = {}) =>
    toSearchHit({
      id: 7,
      api_model,
      title: "A title",
      display_title: null,
      content: null,
      web_url: null,
      ...extra,
    } as Parameters<typeof toSearchHit>[0]);

  it("opens records on this site", () => {
    expect(hit("agents")?.href).toBe("/artists/7");
    expect(hit("sections")?.href).toBe("/read/catalogue-entries/7");
    expect(hit("printed-publications")?.href).toBe(
      "/read/print-publications/7",
    );
    expect(hit("generic-pages")?.href).toBe("/read/pages/7");
    expect(hit("events")?.external).toBe(false);
  });

  it("opens files and microsites where they live", () => {
    const sound = hit("sounds", {
      content: "https://www.artic.edu/assets/abc",
    });
    expect(sound).toMatchObject({
      external: true,
      href: "https://www.artic.edu/assets/abc",
    });
    expect(hit("sounds")).toBeNull();
    expect(
      hit("sites", { web_url: "http://archive.artic.edu/x/" })?.external,
    ).toBe(true);
  });

  it("skips tours that are no longer offered and unknown resources", () => {
    expect(hit("tours")).toBeNull();
    expect(hit("something-new")).toBeNull();
  });
});

describe("opening hours", () => {
  const hours: MuseumHours = {
    note: null,
    days: WEEKDAYS.map((day) => ({
      day,
      closed: day === "tuesday",
      memberOpen: day === "tuesday" ? null : 600,
      publicOpen: day === "tuesday" ? null : 660,
      publicClose: day === "tuesday" ? null : day === "thursday" ? 1200 : 1020,
    })),
  };
  // 2026-11-18 is a Wednesday; Chicago is UTC−6 in November.
  const at = (iso: string) => openState(hours, new Date(iso));

  it("reads ISO durations", () => {
    expect(durationMinutes("PT10H30M")).toBe(630);
    expect(durationMinutes("PT11H")).toBe(660);
    expect(durationMinutes("soon")).toBeNull();
    expect(durationMinutes(null)).toBeNull();
  });

  it("uses the museum's clock, not the server's", () => {
    expect(museumClock(new Date("2026-11-18T04:30:00Z"))).toEqual({
      day: "tuesday",
      minutes: 22 * 60 + 30,
    });
    expect(museumDay(new Date("2026-11-18T04:30:00Z"))).toBe("2026-11-17");
  });

  it("walks through a day", () => {
    expect(at("2026-11-18T15:00:00Z")).toEqual({
      state: "later",
      opensAt: 660,
    });
    expect(at("2026-11-18T16:30:00Z")).toEqual({
      state: "members",
      publicAt: 660,
    });
    expect(at("2026-11-18T18:00:00Z")).toEqual({ state: "open", until: 1020 });
    expect(at("2026-11-19T01:00:00Z")).toMatchObject({
      state: "closed",
      next: { day: "thursday" },
    });
  });

  it("skips the closed day when saying what's next", () => {
    expect(at("2026-11-17T18:00:00Z")).toMatchObject({
      state: "closed",
      next: { day: "wednesday" },
    });
  });

  it("writes clock times for each language", () => {
    expect(formatClock(660, "en")).toBe("11:00 AM");
    expect(formatClock(1020, "zh-tw")).toContain("5:00");
  });
});

describe("shop and media records", () => {
  it("reads prices, ignoring a compare-at price that isn't higher", () => {
    const base = {
      id: 1,
      title: "Book",
      image_url: "https://shop-images.imgix.net/1.jpg",
      web_url: "https://shop.artic.edu/products/1",
      description: null,
      min_current_price: 30,
      max_current_price: 30,
      min_compare_at_price: 0,
      artwork_ids: [5, "x"],
    };
    expect(toProduct(base)?.price).toEqual({ from: 30, to: 30, was: null });
    expect(toProduct({ ...base, min_compare_at_price: 40 })?.price?.was).toBe(
      40,
    );
    expect(toProduct({ ...base, min_current_price: 0 })?.price).toBeNull();
    expect(toProduct(base)?.artworkIds).toEqual([5]);
    expect(toProduct({ ...base, title: null })).toBeNull();
    expect(typeof getProducts).toBe("function");
  });

  it("names media and pairs works with their titles", () => {
    const item = toMediaItem("documents", {
      id: "abc",
      title: "Annual_Report_[12]",
      display_title: null,
      content: "https://www.artic.edu/assets/abc",
      web_url: null,
      description: null,
      credit_line: null,
      artwork_ids: [9],
      artwork_titles: ["Work"],
    });
    expect(item).toMatchObject({
      title: "Annual Report",
      artworks: [{ id: 9, title: "Work" }],
    });
  });
});

describe("museum dictionary", () => {
  const shape = (value: unknown): unknown =>
    value && typeof value === "object"
      ? Object.fromEntries(
          Object.entries(value)
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([key, inner]) => [key, shape(inner)]),
        )
      : "text";

  it("has the same keys in both languages", () => {
    expect(shape(museumZhTw)).toEqual(shape(museumEn));
  });
});
