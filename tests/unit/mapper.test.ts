import { describe, expect, it } from "vitest";
import { toArtwork, toArtworks, UNKNOWN_ARTIST } from "@/lib/artic/mapper";
import { IIIF_URL, rawArtwork, restrictedArtwork } from "../fixtures/aic";

describe("toArtwork", () => {
  it("maps a public-domain work with an image", () => {
    const artwork = toArtwork(rawArtwork(), IIIF_URL);
    expect(artwork).toMatchObject({
      id: 27992,
      title: "A Sunday on La Grande Jatte — 1884",
      artist: "Georges Seurat",
      type: "Painting",
      isPublicDomain: true,
      sourceUrl: "https://www.artic.edu/artworks/27992",
    });
    expect(artwork?.image.src).toBe(
      "https://www.artic.edu/iiif/2/2d484387-2509-5e8e-2c43-22f9981972eb/full/843,/0/default.jpg",
    );
    expect(artwork?.image.alt).toBe(
      "Large painting of people in a crowded park, brushstrokes are dots.",
    );
  });

  it("does not create a displayable work when is_public_domain is false, even with an image id", () => {
    expect(toArtwork(restrictedArtwork(), IIIF_URL)).toBeNull();
  });

  it("does not create a displayable work when is_public_domain is missing", () => {
    expect(
      toArtwork(rawArtwork({ is_public_domain: null }), IIIF_URL),
    ).toBeNull();
  });

  it("does not build an image URL when image_id is missing or malformed", () => {
    expect(toArtwork(rawArtwork({ image_id: null }), IIIF_URL)).toBeNull();
    expect(toArtwork(rawArtwork({ image_id: "" }), IIIF_URL)).toBeNull();
    expect(
      toArtwork(rawArtwork({ image_id: "../secret" }), IIIF_URL),
    ).toBeNull();
  });

  it("fails safely without a trusted IIIF base", () => {
    expect(toArtwork(rawArtwork(), null)).toBeNull();
  });

  it("rejects records that fail schema validation", () => {
    expect(toArtwork({ id: "27992" }, IIIF_URL)).toBeNull();
    expect(toArtwork(null, IIIF_URL)).toBeNull();
    expect(toArtwork(rawArtwork({ id: -1 }), IIIF_URL)).toBeNull();
  });

  it("normalises missing text: no undefined, unknown artist, untitled", () => {
    const artwork = toArtwork(
      rawArtwork({
        title: "  ",
        artist_title: null,
        medium_display: "",
        credit_line: undefined,
        thumbnail: null,
      }),
      IIIF_URL,
    );
    expect(artwork?.title).toBe("Untitled");
    expect(artwork?.artist).toBe(UNKNOWN_ARTIST);
    expect(artwork?.medium).toBeNull();
    expect(artwork?.creditLine).toBeNull();
    expect(artwork?.image.alt).toBe("Untitled, artist unknown");
    expect(artwork?.image.aspectRatio).toBe(0.8);
    expect(JSON.stringify(artwork)).not.toContain("undefined");
  });

  it("caps very long text", () => {
    const artwork = toArtwork(
      rawArtwork({ medium_display: "x".repeat(5000) }),
      IIIF_URL,
    );
    expect(artwork?.medium?.length).toBeLessThanOrEqual(600);
  });
});

describe("toArtworks", () => {
  it("drops restricted, broken and duplicate records but keeps the rest", () => {
    const artworks = toArtworks(
      [
        rawArtwork(),
        restrictedArtwork(),
        { nonsense: true },
        rawArtwork(),
        rawArtwork({ id: 14655 }),
      ],
      IIIF_URL,
    );
    expect(artworks.map((a) => a.id)).toEqual([27992, 14655]);
  });
});
