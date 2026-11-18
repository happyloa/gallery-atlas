import { describe, expect, it } from "vitest";
import {
  isLocale,
  localizePath,
  negotiateLocale,
  switchLocalePath,
} from "@/lib/i18n/config";
import { en } from "@/lib/i18n/dictionaries/en";
import { zhTw } from "@/lib/i18n/dictionaries/zh-tw";
import { format } from "@/lib/i18n/format";

describe("negotiateLocale", () => {
  it("defaults to English", () => {
    expect(negotiateLocale(null)).toBe("en");
    expect(negotiateLocale("")).toBe("en");
    expect(negotiateLocale("fr-FR,fr;q=0.9")).toBe("en");
  });

  it("sends any Chinese preference to the Traditional Chinese interface", () => {
    expect(negotiateLocale("zh-TW,zh;q=0.9,en;q=0.8")).toBe("zh-tw");
    expect(negotiateLocale("zh-Hant-HK")).toBe("zh-tw");
    expect(negotiateLocale("zh-CN")).toBe("zh-tw");
  });

  it("respects quality values and order", () => {
    expect(negotiateLocale("en;q=0.5,zh-TW;q=0.9")).toBe("zh-tw");
    expect(negotiateLocale("en-US,zh-TW;q=0.9")).toBe("en");
    expect(negotiateLocale("zh-TW;q=0,en")).toBe("en");
  });
});

describe("paths", () => {
  it("prefixes and swaps locales", () => {
    expect(localizePath("en")).toBe("/en");
    expect(localizePath("zh-tw", "/about")).toBe("/zh-tw/about");
    expect(localizePath("en", "/?q=x")).toBe("/en?q=x");
    expect(switchLocalePath("/en/artworks/27992", "zh-tw")).toBe(
      "/zh-tw/artworks/27992",
    );
    expect(switchLocalePath("/zh-tw", "en")).toBe("/en");
  });

  it("only accepts the offered locales", () => {
    expect(isLocale("en")).toBe(true);
    expect(isLocale("zh-TW")).toBe(false);
    expect(isLocale("fr")).toBe(false);
  });
});

describe("dictionaries", () => {
  function keys(value: unknown, prefix = ""): string[] {
    if (typeof value !== "object" || value === null) return [prefix];
    return Object.entries(value).flatMap(([key, child]) =>
      keys(child, prefix ? `${prefix}.${key}` : key),
    );
  }

  it("has every English key translated, with no empty strings", () => {
    expect(keys(zhTw).sort()).toEqual(keys(en).sort());
    for (const key of keys(zhTw)) {
      const value = key
        .split(".")
        .reduce<unknown>(
          (node, part) => (node as Record<string, unknown>)[part],
          zhTw,
        );
      expect(typeof value === "string" && value.trim().length > 0, key).toBe(
        true,
      );
    }
  });

  it("keeps the same placeholders in both languages", () => {
    const placeholders = (s: string) =>
      (s.match(/\{\w+\}/g) ?? []).sort().join(",");
    for (const key of keys(en)) {
      const get = (dict: unknown) =>
        key
          .split(".")
          .reduce<unknown>(
            (node, part) => (node as Record<string, unknown>)[part],
            dict,
          ) as string;
      expect(placeholders(get(zhTw)), key).toBe(placeholders(get(en)));
    }
  });

  it("fills placeholders and leaves unknown ones alone", () => {
    expect(
      format("第 {current} 件，共 {total} 件", { current: 2, total: 8 }),
    ).toBe("第 2 件，共 8 件");
    expect(format("{a} {b}", { a: 1 })).toBe("1 {b}");
  });
});
