/**
 * The API's `description` field is a small HTML fragment (<p>, <em>/<i>, <a>, <br> in
 * practice). It is turned into plain data here — paragraphs of text runs, some italic —
 * and rendered as ordinary React elements. No upstream markup reaches the DOM, so there is
 * nothing to sanitise and no dangerouslySetInnerHTML.
 */

import type { TextRun } from "@/lib/artwork/types";

export type { TextRun } from "@/lib/artwork/types";
export type DescriptionParagraph = TextRun[];

const MAX_PARAGRAPHS = 20;
const MAX_TOTAL_CHARS = 6000;

const NAMED_ENTITIES: Record<string, string> = {
  amp: "&",
  lt: "<",
  gt: ">",
  quot: '"',
  apos: "'",
  nbsp: " ",
  ndash: "–",
  mdash: "—",
  lsquo: "‘",
  rsquo: "’",
  ldquo: "“",
  rdquo: "”",
  hellip: "…",
};

export function decodeEntities(text: string): string {
  return text.replace(
    /&(#x[0-9a-f]+|#\d+|[a-z]+);/gi,
    (match, entity: string) => {
      if (entity[0] === "#") {
        const code =
          entity[1].toLowerCase() === "x"
            ? parseInt(entity.slice(2), 16)
            : parseInt(entity.slice(1), 10);
        return Number.isInteger(code) && code > 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : "";
      }
      return NAMED_ENTITIES[entity.toLowerCase()] ?? match;
    },
  );
}

/**
 * Parses the fragment into paragraphs. Unknown tags are dropped but their text is kept;
 * script and style contents are dropped entirely. Returns null when nothing readable remains.
 */
export function parseDescription(
  html: string | null | undefined,
  limits: { maxParagraphs?: number; maxChars?: number } = {},
): DescriptionParagraph[] | null {
  if (!html) return null;
  const maxChars = limits.maxChars ?? MAX_TOTAL_CHARS;
  const maxParagraphs = limits.maxParagraphs ?? MAX_PARAGRAPHS;

  const paragraphs: DescriptionParagraph[] = [];
  let current: TextRun[] = [];
  let italicDepth = 0;
  let skipDepth = 0;
  let total = 0;

  const flush = () => {
    const trimmed = trimRuns(current);
    if (trimmed.length > 0) paragraphs.push(trimmed);
    current = [];
  };
  const pushText = (raw: string) => {
    if (skipDepth > 0 || total >= maxChars) return;
    let text = decodeEntities(raw).replace(/\s+/g, " ");
    if (!text) return;
    text = text.slice(0, maxChars - total);
    total += text.length;
    const italic = italicDepth > 0;
    const last = current[current.length - 1];
    if (last && last.italic === italic) last.text += text;
    else current.push({ text, italic });
  };

  const tagPattern =
    /<\s*(\/?)\s*([a-zA-Z][\w-]*)[^>]*?(\/?)\s*>|<!--[\s\S]*?-->/g;
  let cursor = 0;
  for (const match of html.matchAll(tagPattern)) {
    pushText(html.slice(cursor, match.index));
    cursor = (match.index ?? 0) + match[0].length;
    if (!match[2]) continue; // comment
    const closing = match[1] === "/";
    const name = match[2].toLowerCase();
    if (name === "script" || name === "style") {
      skipDepth = Math.max(0, skipDepth + (closing ? -1 : 1));
    } else if (name === "em" || name === "i" || name === "cite") {
      italicDepth = Math.max(0, italicDepth + (closing ? -1 : 1));
    } else if (name === "p" || name === "div" || name === "li") {
      flush();
    } else if (name === "br") {
      pushText(" ");
    }
  }
  pushText(html.slice(cursor));
  flush();

  const limited = paragraphs.slice(0, maxParagraphs);
  return limited.length > 0 ? limited : null;
}

/** Drops empty runs and trims whitespace at the paragraph's edges. */
function trimRuns(runs: TextRun[]): TextRun[] {
  const result = runs
    .filter((run) => run.text.length > 0)
    .map((run) => ({ ...run }));
  if (result.length > 0) result[0].text = result[0].text.trimStart();
  if (result.length > 0)
    result[result.length - 1].text = result[result.length - 1].text.trimEnd();
  return result.filter((run) => run.text.length > 0);
}
