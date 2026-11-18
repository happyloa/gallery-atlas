import { afterEach, describe, expect, it, vi } from "vitest";
import { AicError } from "@/lib/artic/client";
import { MAX_LIST_PAGE } from "@/lib/artic/records";
import {
  attempt,
  keywordParam,
  languageAlternates,
  localeOf,
  pageParam,
  stringParam,
  withQuery,
} from "@/lib/page-params";
import { onUpstreamFailure } from "@/lib/render-health";

const reported = vi.fn();
onUpstreamFailure(reported);

afterEach(() => {
  reported.mockClear();
});

describe("localeOf", () => {
  it("falls back to English for anything that is not a language of the site", () => {
    expect(localeOf("zh-tw")).toBe("zh-tw");
    expect(localeOf("en")).toBe("en");
    expect(localeOf("fr")).toBe("en");
    expect(localeOf("")).toBe("en");
  });
});

describe("stringParam and keywordParam", () => {
  it("takes the first of a repeated parameter", () => {
    expect(stringParam({ tab: "artists" }, "tab")).toBe("artists");
    expect(stringParam({ tab: ["events", "artists"] }, "tab")).toBe("events");
    expect(stringParam({}, "tab")).toBeUndefined();
  });

  it("tidies the keyword and caps its length", () => {
    expect(keywordParam({ q: "  water \n lilies " })).toBe("water lilies");
    expect(keywordParam({})).toBe("");
    expect(keywordParam({ q: "x".repeat(500) })).toHaveLength(100);
  });
});

describe("pageParam", () => {
  it("reads a page number, and treats anything else as the first page", () => {
    expect(pageParam({ page: "3" })).toBe(3);
    expect(pageParam({ page: ["4", "9"] })).toBe(4);
    for (const page of [undefined, "", "0", "abc", "2.5", "-1", " 2", "1e2"])
      expect(pageParam({ page })).toBe(1);
  });

  it("says there is no page past the museum's search window", () => {
    // 24 records a page: page 41 ends at result 984, page 42 would pass 1,000.
    expect(MAX_LIST_PAGE).toBe(41);
    expect(pageParam({ page: "41" })).toBe(41);
    expect(pageParam({ page: "42" })).toBeNull();
    expect(pageParam({ page: "9999" })).toBeNull();
    expect(pageParam({ page: "9".repeat(40) })).toBeNull();
  });

  it("takes the last page of lists with another page size", () => {
    expect(pageParam({ page: "83" }, 83)).toBe(83);
    expect(pageParam({ page: "84" }, 83)).toBeNull();
    expect(pageParam({ page: "50" }, 50)).toBe(50);
  });
});

describe("withQuery", () => {
  it("leaves out empty values and the first page", () => {
    expect(withQuery("/en/artists", {})).toBe("/en/artists");
    expect(
      withQuery("/en/artists", { q: "", type: null, tab: undefined, page: 1 }),
    ).toBe("/en/artists");
    expect(withQuery("/en/artists", { q: "van gogh", type: 2, page: 3 })).toBe(
      "/en/artists?q=van+gogh&type=2&page=3",
    );
  });

  it("escapes what a visitor typed", () => {
    const href = withQuery("/en/search", { q: "a&b=c#d" });
    expect(href).toBe("/en/search?q=a%26b%3Dc%23d");
    expect(new URL(href, "https://x.test").searchParams.get("q")).toBe(
      "a&b=c#d",
    );
  });
});

describe("languageAlternates", () => {
  it("gives a canonical address, each language, and a default without one", () => {
    expect(languageAlternates("zh-tw", "/about")).toEqual({
      canonical: "/zh-tw/about",
      languages: {
        en: "/en/about",
        "zh-Hant-TW": "/zh-tw/about",
        "x-default": "/about",
      },
    });
  });

  it("handles the homepage", () => {
    expect(languageAlternates("en", "/")).toEqual({
      canonical: "/en",
      languages: { en: "/en", "zh-Hant-TW": "/zh-tw", "x-default": "/" },
    });
  });

  it("keeps a paged list pointing at its own page in every language", () => {
    expect(languageAlternates("en", "/artists", { page: 3 })).toEqual({
      canonical: "/en/artists?page=3",
      languages: {
        en: "/en/artists?page=3",
        "zh-Hant-TW": "/zh-tw/artists?page=3",
        "x-default": "/artists?page=3",
      },
    });
    // The first page has one address, with or without ?page=1.
    expect(languageAlternates("en", "/artists", { page: 1 }).canonical).toBe(
      "/en/artists",
    );
    expect(
      languageAlternates("en", "/media", { q: "", kind: "videos", page: 2 })
        .canonical,
    ).toBe("/en/media?kind=videos&page=2");
  });
});

describe("attempt", () => {
  it("passes a result through", async () => {
    await expect(attempt(async () => 7)).resolves.toEqual({
      data: 7,
      failure: null,
    });
    expect(reported).not.toHaveBeenCalled();
  });

  it("describes a failure and marks the page as incomplete", async () => {
    const timeout = await attempt(async () => {
      throw new AicError("timeout", "slow");
    });
    expect(timeout).toEqual({
      data: null,
      failure: { reason: "timeout", retryable: true },
    });
    expect(reported).toHaveBeenCalledTimes(1);

    const limited = await attempt(async () => {
      throw new AicError("rate_limited", "busy", 429);
    });
    expect(limited.failure?.reason).toBe("rate_limited");
    expect(reported).toHaveBeenCalledTimes(2);
  });

  it("marks the page for an error that did not come from the museum's API", async () => {
    const result = await attempt(async () => {
      throw new TypeError("not a function");
    });
    expect(result.failure).toEqual({ reason: "generic", retryable: true });
    expect(reported).toHaveBeenCalledTimes(1);
  });

  it("lets a page with a stable answer be kept", async () => {
    for (const code of ["not_found", "bad_request"] as const) {
      const result = await attempt(async () => {
        throw new AicError(code, "the same next time");
      });
      expect(result.failure).toEqual({ reason: "generic", retryable: false });
    }
    expect(reported).not.toHaveBeenCalled();
  });
});
