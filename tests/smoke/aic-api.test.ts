/**
 * Live smoke tests against api.artic.edu. Run with `npm run test:smoke`; they need network
 * access and are kept out of `npm test` so an outage upstream never fails the main gate.
 */
import { describe, expect, it } from "vitest";
import {
  getArtist,
  getArtwork,
  getArtworkDetail,
  getArtworksByIds,
  getMoreByArtist,
  searchArtworks,
} from "@/lib/artic/artworks";
import { getCollectionOverview } from "@/lib/artic/overview";
import { EMPTY_QUERY } from "@/lib/artic/search-url";

describe("Art Institute of Chicago API (live)", () => {
  it("returns La Grande Jatte as a displayable public-domain work", async () => {
    const result = await getArtwork(27992);
    expect(result.status).toBe("ok");
    if (result.status === "ok") {
      expect(result.artwork.artist).toBe("Georges Seurat");
      expect(result.artwork.image.src).toMatch(
        /^https:\/\/www\.artic\.edu\/iiif\/2\/[0-9a-f-]{36}\/full\/843,\/0\/default\.jpg$/,
      );
    }
  });

  it("treats Nighthawks (image, not public domain) as restricted", async () => {
    expect(await getArtwork(111628)).toEqual({ status: "restricted" });
  });

  it("returns not_found for an id that does not exist", async () => {
    expect(await getArtwork(999999999)).toEqual({ status: "not_found" });
  });

  it("searches public-domain paintings by keyword", async () => {
    const result = await searchArtworks({
      ...EMPTY_QUERY,
      q: "monet water lilies",
      type: "painting",
      page: 1,
    });
    expect(result.total).toBeGreaterThan(0);
    expect(result.artworks.length).toBeGreaterThan(0);
    expect(
      result.artworks.every((a) => a.isPublicDomain && a.type === "Painting"),
    ).toBe(true);
  });

  it("reads saved works in a batch and drops the restricted one", async () => {
    const result = await getArtworksByIds([27992, 111628, 14655]);
    expect(result.artworks.map((a) => a.id)).toEqual([27992, 14655]);
    expect(result.unavailable).toEqual([111628]);
  });

  it("reads an artist and more of their works", async () => {
    const lookup = await getArtist(40810);
    expect(lookup).toMatchObject({ status: "ok", artist: { name: "Georges Seurat" } });
    const more = await getMoreByArtist(40810, 27992);
    expect(more.artworks.length).toBeGreaterThan(0);
    expect(more.artworks.some((a) => a.id === 27992)).toBe(false);
  });

  it("reads the detail extras for a well-documented work", async () => {
    const lookup = await getArtworkDetail(27992);
    expect(lookup.status).toBe("ok");
    if (lookup.status !== "ok") return;
    expect(lookup.artwork.artistId).toBe(40810);
    expect(lookup.artwork.era).toBe("1800s");
    expect(lookup.artwork.tags.style.length).toBeGreaterThan(0);
    expect(lookup.artwork.record.inscriptions).not.toBeNull();
  });

  it("filters by colour, era and tag together", async () => {
    const result = await searchArtworks({
      ...EMPTY_QUERY,
      era: "1800s",
      color: "blue",
      style: "Impressionism",
    });
    expect(result.total).toBeGreaterThan(0);
  });

  it("counts the homepage entrances, eras and colours", async () => {
    const overview = await getCollectionOverview();
    expect(overview).not.toBeNull();
    expect(overview?.entrances.japanese.count).toBeGreaterThan(1000);
    expect(overview?.entrances.impressionism.cover).not.toBeNull();
    expect(overview?.eras["1800s"]).toBeGreaterThan(10000);
    expect(overview?.colors?.blue).toBeGreaterThan(100);
  });
});
