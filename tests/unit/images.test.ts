import { describe, expect, it } from "vitest";
import {
  aspectRatioFrom,
  buildArtworkImage,
  iiifUrl,
  isAllowedWidth,
  resolveIiifBase,
  safePlaceholder,
} from "@/lib/artic/images";

const IMAGE_ID = "2d484387-2509-5e8e-2c43-22f9981972eb";
const BASE = "https://www.artic.edu/iiif/2";

describe("resolveIiifBase", () => {
  it("accepts the museum IIIF base, with or without a trailing slash", () => {
    expect(resolveIiifBase("https://www.artic.edu/iiif/2")).toBe(BASE);
    expect(resolveIiifBase("https://www.artic.edu/iiif/2/")).toBe(BASE);
  });

  it("fails safely when the base is missing", () => {
    expect(resolveIiifBase(undefined)).toBeNull();
    expect(resolveIiifBase(null)).toBeNull();
    expect(resolveIiifBase("")).toBeNull();
  });

  it("rejects any other host, scheme, path or query", () => {
    for (const bad of [
      "https://evil.example/iiif/2",
      "http://www.artic.edu/iiif/2",
      "https://www.artic.edu.evil.example/iiif/2",
      "https://www.artic.edu/iiif/3",
      "https://www.artic.edu/iiif/2?x=1",
      "javascript:alert(1)",
      "not a url",
    ]) {
      expect(resolveIiifBase(bad), bad).toBeNull();
    }
  });
});

describe("iiifUrl", () => {
  it("builds the documented URL pattern", () => {
    expect(iiifUrl(BASE, IMAGE_ID, 843, true)).toBe(
      `${BASE}/${IMAGE_ID}/full/843,/0/default.jpg`,
    );
  });

  it("only allows the museum's documented widths", () => {
    expect(iiifUrl(BASE, IMAGE_ID, 500, true)).toBeNull();
    expect(iiifUrl(BASE, IMAGE_ID, 3000, true)).toBeNull();
    expect(isAllowedWidth(400, false)).toBe(true);
  });

  it("allows 1200 and 1686 only for public-domain works", () => {
    expect(iiifUrl(BASE, IMAGE_ID, 1686, true)).not.toBeNull();
    expect(iiifUrl(BASE, IMAGE_ID, 1686, false)).toBeNull();
    expect(iiifUrl(BASE, IMAGE_ID, 1200, false)).toBeNull();
  });

  it("rejects malformed image ids and unvetted bases", () => {
    expect(iiifUrl(BASE, "../../etc/passwd", 843, true)).toBeNull();
    expect(iiifUrl(BASE, "", 843, true)).toBeNull();
    expect(
      iiifUrl("https://evil.example/iiif/2", IMAGE_ID, 843, true),
    ).toBeNull();
  });
});

describe("aspectRatioFrom", () => {
  it("uses the thumbnail size when present", () => {
    expect(aspectRatioFrom(9310, 6237)).toBeCloseTo(1.4927, 3);
  });

  it("falls back to 4:5 when dimensions are missing or invalid", () => {
    expect(aspectRatioFrom(null, 100)).toBe(0.8);
    expect(aspectRatioFrom(100, 0)).toBe(0.8);
    expect(aspectRatioFrom(Number.NaN, 100)).toBe(0.8);
  });

  it("clamps extreme ratios", () => {
    expect(aspectRatioFrom(10000, 1)).toBe(5);
    expect(aspectRatioFrom(1, 10000)).toBe(0.2);
  });
});

describe("safePlaceholder", () => {
  it("keeps small base64 image data URIs only", () => {
    expect(safePlaceholder("data:image/gif;base64,R0lGODlh")).toBe(
      "data:image/gif;base64,R0lGODlh",
    );
    expect(
      safePlaceholder(
        'data:image/gif;base64,AA") ; background:url(https://evil',
      ),
    ).toBeNull();
    expect(safePlaceholder("https://example.com/x.gif")).toBeNull();
    expect(
      safePlaceholder(`data:image/gif;base64,${"A".repeat(5000)}`),
    ).toBeNull();
  });
});

describe("buildArtworkImage", () => {
  it("returns src and a srcset of allowed widths", () => {
    const image = buildArtworkImage({
      base: BASE,
      imageId: IMAGE_ID,
      aspectRatio: 1.5,
      alt: "x",
      placeholder: null,
    });
    expect(image?.src).toContain("/full/843,/");
    expect(image?.srcSet.split(", ").map((part) => part.split(" ")[1])).toEqual(
      ["400w", "600w", "843w", "1200w"],
    );
  });
});
