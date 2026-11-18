import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";

export interface Segment {
  text: string;
  /** Position among the words, 0..1, which sets when the word lights up. */
  progress: number | null;
}

/** Splits text into words (Chinese included) and punctuation so each can light up on its own. */
export function splitWords(text: string, locale: Locale): Segment[] {
  const parts: { text: string; word: boolean }[] =
    typeof Intl.Segmenter === "function"
      ? Array.from(
          new Intl.Segmenter(LOCALE_TAGS[locale], {
            granularity: "word",
          }).segment(text),
          (s) => ({
            text: s.segment,
            word: s.segment.trim() !== "",
          }),
        )
      : Array.from(text, (char) => ({ text: char, word: char.trim() !== "" }));

  const total = parts.filter((p) => p.word).length;
  let index = 0;
  return parts.map((p) => ({
    text: p.text,
    progress: p.word ? (total > 1 ? index++ / (total - 1) : 0) : null,
  }));
}
