/**
 * Live smoke tests against api.artic.edu. Run with `npm run test:smoke`; they need network
 * access and are kept out of `npm test` so an outage upstream never fails the main gate.
 */
import { describe, expect, it } from "vitest";
import {
  getArtwork,
  getArtworksByIds,
  searchArtworks,
} from "@/lib/artic/artworks";

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
});
