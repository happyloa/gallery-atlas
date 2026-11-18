import { describe, expect, it } from "vitest";
import { MAX_PAGE } from "@/lib/artic/config";
import {
  artworksByIdsPath,
  buildSearchRequest,
  normalizeKeyword,
  parseArtworkId,
  parseSearchQuery,
  searchHref,
  searchPath,
} from "@/lib/artic/queries";

describe("parseSearchQuery", () => {
  it("defaults to an empty search on page 1", () => {
    expect(parseSearchQuery(new URLSearchParams())).toEqual({
      ok: true,
      query: { q: "", type: null, page: 1 },
    });
  });

  it("reads keyword, whitelisted type and page", () => {
    const result = parseSearchQuery({
      q: "  monet  ",
      type: "painting",
      page: "3",
    });
    expect(result).toEqual({
      ok: true,
      query: { q: "monet", type: "painting", page: 3 },
    });
  });

  it("ignores types outside the whitelist", () => {
    const result = parseSearchQuery({ type: "weapons'; DROP" });
    expect(result.query.type).toBeNull();
  });

  it("uses the first value when a parameter repeats", () => {
    expect(parseSearchQuery({ q: ["a", "b"] }).query.q).toBe("a");
  });

  it("caps the keyword at 100 characters, counting by code point", () => {
    expect(parseSearchQuery({ q: "a".repeat(250) }).query.q).toHaveLength(100);
    const emoji = "🎨".repeat(150);
    expect(Array.from(parseSearchQuery({ q: emoji }).query.q)).toHaveLength(
      100,
    );
  });

  it("strips control characters and collapses whitespace", () => {
    expect(normalizeKeyword("water\u0000\nlilies\t ")).toBe("water lilies");
  });

  it.each(["0", "-1", "1.5", "abc", "1e3", "9999999"])(
    "rejects page %s without touching upstream",
    (page) => {
      const result = parseSearchQuery({ q: "monet", page });
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(result.error.code).toBe("invalid_page");
        expect(result.query).toEqual({ q: "monet", type: null, page: 1 });
      }
    },
  );

  it("refuses pages beyond the 1,000-result window", () => {
    expect(parseSearchQuery({ page: String(MAX_PAGE) }).ok).toBe(true);
    const result = parseSearchQuery({ page: String(MAX_PAGE + 1) });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe("page_out_of_range");
  });
});

describe("buildSearchRequest", () => {
  it("always filters to public-domain works with an image", () => {
    const body = buildSearchRequest({ q: "", type: null, page: 1 }) as {
      query: { bool: { filter: unknown[] } };
    };
    expect(body.query.bool.filter).toEqual([
      { term: { is_public_domain: true } },
      { exists: { field: "image_id" } },
    ]);
  });

  it("adds the type id and a plain-text keyword match", () => {
    const body = buildSearchRequest({
      q: 'Renoir & "two sisters"',
      type: "print",
      page: 2,
    }) as {
      query: {
        bool: {
          filter: unknown[];
          must: Array<{ multi_match: { query: string; type: string } }>;
        };
      };
      limit: number;
      page: number;
    };
    expect(body.query.bool.filter).toContainEqual({
      term: { artwork_type_id: 18 },
    });
    expect(body.query.bool.must[0].multi_match.query).toBe(
      'Renoir & "two sisters"',
    );
    expect(body.query.bool.must[0].multi_match.type).toBe("cross_fields");
    expect(body).toMatchObject({ limit: 12, page: 2 });
  });

  it("URL-encodes special characters into the params query string", () => {
    const path = searchPath({ q: "café & co/?#", type: null, page: 1 });
    expect(path.startsWith("/artworks/search?params=")).toBe(true);
    expect(path).not.toMatch(/[ &#?]co/);
    const decoded = JSON.parse(decodeURIComponent(path.split("params=")[1]));
    expect(decoded.query.bool.must[0].multi_match.query).toBe("café & co/?#");
  });
});

describe("links and ids", () => {
  it("builds short Explore links", () => {
    expect(searchHref({ q: "monet water", type: "painting", page: 1 })).toBe(
      "/?q=monet+water&type=painting#explore",
    );
    expect(searchHref({ page: 2 })).toBe("/?page=2#explore");
    expect(searchHref({})).toBe("/#explore");
  });

  it("parses artwork ids strictly", () => {
    expect(parseArtworkId("27992")).toBe(27992);
    for (const bad of [
      "0",
      "-5",
      "12abc",
      "1.5",
      "",
      null,
      undefined,
      "9999999999",
    ]) {
      expect(parseArtworkId(bad), String(bad)).toBeNull();
    }
  });

  it("puts batch ids into the ids parameter", () => {
    expect(artworksByIdsPath([1, 2, 3])).toMatch(
      /^\/artworks\?ids=1,2,3&limit=3&fields=/,
    );
  });
});
