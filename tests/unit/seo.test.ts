import { afterEach, describe, expect, it, vi } from "vitest";
import robots from "@/app/robots";
import sitemap from "@/app/sitemap";
import { serializeJsonLd } from "@/lib/json-ld";
import { absoluteUrl, siteUrl } from "@/lib/site";

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("serializeJsonLd", () => {
  it("cannot be used to close the script element", () => {
    const json = serializeJsonLd({
      name: '</script><script>alert(1)</script> & "x"',
    });
    expect(json).not.toMatch(/[<>]/);
    expect(json).not.toContain("&");
    expect(JSON.parse(json)).toEqual({
      name: '</script><script>alert(1)</script> & "x"',
    });
  });

  it("escapes line and paragraph separators", () => {
    expect(serializeJsonLd({ a: "x y" })).toBe('{"a":"x\\u2028y"}');
  });
});

describe("site URL", () => {
  it("is absent in local development", () => {
    vi.stubEnv("SITE_URL", "");
    expect(siteUrl()).toBeNull();
    expect(absoluteUrl("/en")).toBe("/en");
  });

  it("uses only the origin of SITE_URL and rejects other schemes", () => {
    vi.stubEnv("SITE_URL", "https://gallery.example.org/some/path?x=1");
    expect(siteUrl()?.toString()).toBe("https://gallery.example.org/");
    expect(absoluteUrl("/zh-tw/about")).toBe(
      "https://gallery.example.org/zh-tw/about",
    );
    vi.stubEnv("SITE_URL", "javascript:alert(1)");
    expect(siteUrl()).toBeNull();
  });
});

describe("robots and sitemap", () => {
  it("keeps personal pages and the API out of search engines", () => {
    vi.stubEnv("SITE_URL", "https://gallery.example.org");
    const rules = robots();
    expect(rules.rules).toMatchObject({
      disallow: ["/api/", "/en/collection", "/zh-tw/collection"],
    });
    expect(rules.sitemap).toBe("https://gallery.example.org/sitemap.xml");
  });

  it("lists both languages with hreflang alternates", () => {
    vi.stubEnv("SITE_URL", "https://gallery.example.org");
    const entries = sitemap();
    const home = entries.find(
      (entry) => entry.url === "https://gallery.example.org/en",
    );
    expect(home?.alternates?.languages).toEqual({
      en: "https://gallery.example.org/en",
      "zh-Hant-TW": "https://gallery.example.org/zh-tw",
    });
    expect(
      entries.some(
        (entry) =>
          entry.url === "https://gallery.example.org/zh-tw/artworks/27992",
      ),
    ).toBe(true);
    expect(entries.every((entry) => !entry.url.includes("/collection"))).toBe(
      true,
    );
  });
});
