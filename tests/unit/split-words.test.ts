import { describe, expect, it } from "vitest";
import { splitWords } from "@/lib/text/split-words";

describe("splitWords", () => {
  it("keeps the text intact when joined back together", () => {
    for (const [text, locale] of [
      ["Take your time with them, and keep the ones you like.", "en"],
      ["Gallery Atlas 裡的每件作品都屬於公有領域。", "zh-tw"],
    ] as const) {
      expect(
        splitWords(text, locale)
          .map((s) => s.text)
          .join(""),
      ).toBe(text);
    }
  });

  it("gives whitespace no progress and spreads words from 0 to 1", () => {
    const segments = splitWords("one two three", "en");
    expect(
      segments.filter((s) => s.progress === null).map((s) => s.text),
    ).toEqual([" ", " "]);
    expect(
      segments.filter((s) => s.progress !== null).map((s) => s.progress),
    ).toEqual([0, 0.5, 1]);
  });

  it("splits Chinese into more than one word and lights punctuation too", () => {
    const segments = splitWords("慢慢看，把作品收進收藏。", "zh-tw");
    const lit = segments.filter((s) => s.progress !== null);
    expect(lit.length).toBeGreaterThan(3);
    expect(lit.at(-1)?.text).toBe("。");
  });
});
