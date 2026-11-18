/**
 * Live checks for the museum's records beyond the collection. Requests are spaced out:
 * the API answers bursts with 429.
 */
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { getArtworkDetail, searchArtworks } from "@/lib/artic/artworks";
import {
  getArtistIndex,
  getArtistTypes,
  getBrowseOverview,
  getFacetTerm,
  getFacetTerms,
  getPlaceRows,
  getVocabularies,
} from "@/lib/artic/directory";
import {
  getEvent,
  getHours,
  getOccurrences,
  getPrograms,
  museumDay,
} from "@/lib/artic/events";
import {
  getLibraryEntry,
  getLibraryList,
  getLibraryOverview,
  LIBRARY_KINDS,
} from "@/lib/artic/library";
import { getArtworkResources, getMedia, MEDIA_KINDS } from "@/lib/artic/media";
import { getProduct, getProducts } from "@/lib/artic/shop";
import { searchSite } from "@/lib/artic/site-search";
import { EMPTY_QUERY } from "@/lib/artic/search-url";

const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("museum records (live)", { timeout: 60_000 }, () => {
  // Lets the API's per-minute allowance recover from the smoke file before this one.
  beforeAll(() => pause(65_000), 70_000);
  beforeEach(() => pause(1500));

  it("searches across resources and counts each tab", async () => {
    const result = await searchSite("monet", "all", 1);
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.tabCounts.artists).toBeGreaterThan(0);
    expect(result.tabCounts.reading).toBeGreaterThan(10);
    await pause(1500);
    const reading = await searchSite("monet", "reading", 1);
    expect(reading.items.every((hit) => hit.href.startsWith("/read/"))).toBe(
      true,
    );
  });

  it("ranks artists by works and finds them by name", async () => {
    const ranked = await getArtistIndex({ keyword: "", type: null, page: 1 });
    expect(ranked.items.length).toBeGreaterThan(10);
    expect(ranked.items[0]?.works).toBeGreaterThan(100);
    await pause(1500);
    const found = await getArtistIndex({
      keyword: "monet",
      type: null,
      page: 1,
    });
    expect(found.items.map((a) => a.name)).toContain("Claude Monet");
    await pause(1500);
    expect((await getArtistTypes()).map((t) => t.title)).toContain(
      "Individual",
    );
  });

  it("browses classification terms down to their works", async () => {
    const overview = await getBrowseOverview();
    expect(overview.samples.departments?.length).toBeGreaterThan(0);
    expect(overview.samples.types?.length).toBeGreaterThan(0);
    expect(overview.samples.themes?.length).toBeGreaterThan(0);
    await pause(1500);

    const styles = await getFacetTerms("styles", "");
    const style = styles[0];
    expect(style?.works).toBeGreaterThan(0);
    await pause(1500);
    const term = await getFacetTerm("styles", style?.id ?? "");
    expect(term?.title).toBe(style?.title);
    await pause(1500);
    const works = await searchArtworks(EMPTY_QUERY, {}, { term: term?.term });
    expect(works.total).toBeGreaterThan(0);

    await pause(1500);
    const department = await getFacetTerm("departments", "PC-10");
    await pause(1500);
    const paintings = await searchArtworks(
      EMPTY_QUERY,
      {},
      { term: department?.term },
    );
    expect(paintings.total).toBeGreaterThan(100);

    await pause(1500);
    expect((await getFacetTerms("materials", "oil")).length).toBeGreaterThan(0);
    await pause(1500);
    expect(await getFacetTerm("styles", "TM-66")).toBeNull();
  });

  it("lists places and vocabularies", async () => {
    const places = await getPlaceRows("");
    expect(places.find((p) => p.key === "france")?.works).toBeGreaterThan(100);
    await pause(1500);
    expect((await getPlaceRows("paris")).length).toBeGreaterThan(0);
    await pause(1500);
    const vocabularies = await getVocabularies();
    expect(vocabularies.every((v) => v.terms.length > 0)).toBe(true);
  });

  it("opens one record of every library kind", async () => {
    const overview = await getLibraryOverview();
    expect(overview.counts.articles).toBeGreaterThan(100);
    expect(overview.sections.length).toBeGreaterThan(0);
    for (const kind of LIBRARY_KINDS) {
      await pause(1500);
      const list = await getLibraryList(kind, { keyword: "", page: 1 });
      const first = list.items[0];
      expect(first, kind).toBeDefined();
      await pause(1500);
      const entry = await getLibraryEntry(kind, first?.id ?? 0);
      expect(entry?.title, kind).toBe(first?.title);
      expect(entry?.sourceUrl, kind).toMatch(/^https?:\/\/[a-z.]*artic\.edu/);
    }
  }, 180_000);

  it("reads a catalogue entry and a catalogue's contents", async () => {
    const entry = await getLibraryEntry("catalogue-entries", 36744351949);
    expect(entry?.artworkId).toBe(16568);
    expect(entry?.parent?.id).toBe(135466);
    expect(entry?.body.map((s) => s.heading)).toContain("Provenance");
    await pause(1500);
    const catalogue = await getLibraryEntry("catalogues", 135466);
    expect(catalogue?.contents.length).toBeGreaterThan(10);
  });

  it("finds keywords in the library", async () => {
    const found = await getLibraryList("articles", {
      keyword: "monet",
      page: 1,
    });
    expect(found.total).toBeGreaterThan(0);
    expect(found.total).toBeLessThan(100);
  });

  it("lists upcoming events and opens one", async () => {
    const today = museumDay(new Date());
    const upcoming = await getOccurrences({ today });
    expect(upcoming.items.length).toBeGreaterThan(0);
    expect(upcoming.items.every((o) => o.day >= today)).toBe(true);
    await pause(1500);
    const programs = await getPrograms(today);
    expect(programs.length).toBeGreaterThan(0);
    await pause(1500);
    const filtered = await getOccurrences({
      today,
      program: programs[0]?.id ?? null,
    });
    expect(filtered.total).toBeLessThanOrEqual(upcoming.total);
    await pause(1500);
    const event = await getEvent(upcoming.items[0]?.eventId ?? 0, today);
    expect(event?.title).toBeTruthy();
    expect(event?.occurrences.length).toBeGreaterThan(0);
  });

  it("reads opening hours for all seven days", async () => {
    const hours = await getHours();
    expect(hours?.days).toHaveLength(7);
    expect(hours?.days.some((day) => day.publicOpen !== null)).toBe(true);
  });

  it("pages through the shop", async () => {
    const products = await getProducts(2);
    expect(products.items.length).toBeGreaterThan(0);
    expect(products.items[0]?.url).toMatch(/^https:\/\/shop\.artic\.edu\//);
    await pause(1500);
    const product = await getProduct(products.items[0]?.id ?? 0);
    expect(product?.title).toBe(products.items[0]?.title);
  });

  it("lists every kind of media", async () => {
    for (const kind of MEDIA_KINDS) {
      await pause(1500);
      const media = await getMedia(kind, { keyword: "", page: 1 });
      expect(media.items.length, kind).toBeGreaterThan(0);
    }
  });

  it("gathers what the museum links to a work", async () => {
    const lookup = await getArtworkDetail(16568);
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") return;
    expect(lookup.artwork.referenceNumber).toBe("1933.1157");
    expect(lookup.artwork.department?.id).toBe("PC-10");
    await pause(1500);
    const resources = await getArtworkResources(lookup.artwork);
    expect(resources.catalogue[0]?.id).toBe(36744351949);
    expect(resources.documents.length).toBeGreaterThan(0);
  });
});
