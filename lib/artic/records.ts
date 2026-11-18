/**
 * Shared plumbing for the museum's non-artwork records: keyword search, tolerant list and
 * detail reads, and turning the API's text formats into plain data. Server only.
 */
import { z } from "zod";
import type { TextRun } from "@/lib/artwork/types";
import { aicGet, AicError, isAicError } from "./client";
import {
  MAX_REQUEST_PATH,
  MAX_SEARCH_RESULTS,
  REVALIDATE_REFERENCE,
} from "./config";
import { decodeEntities, parseDescription } from "./description";

export type Clause = Record<string, unknown>;

/** Records per page on the index pages. */
export const LIST_SIZE = 24;

const LONG_TEXT = { maxParagraphs: 900, maxChars: 150_000 };

export const textField = z.string().nullish().catch(null);
export const intField = z.number().int().nullish().catch(null);
export const listField = z.array(z.unknown()).nullish().catch(null);

export interface RecordSearch {
  keyword?: string;
  keywordFields?: readonly string[];
  filter?: Clause[];
  sort?: Clause[];
  fields?: string;
  limit: number;
  page?: number;
  aggs?: Clause;
}

/**
 * The `params` object for a search. Keywords go in a `multi_match` with every word
 * required: the API's own `q` only ranks results once a filter is present.
 */
export function searchParamsFor(search: RecordSearch): Clause {
  const bool: Clause = {};
  if (search.keyword)
    bool.must = [
      {
        multi_match: {
          query: search.keyword,
          fields: search.keywordFields ?? ["title"],
          operator: "and",
        },
      },
    ];
  if (search.filter?.length) bool.filter = search.filter;
  return {
    ...(Object.keys(bool).length > 0 ? { query: { bool } } : {}),
    ...(search.sort ? { sort: search.sort } : {}),
    ...(search.fields ? { fields: search.fields } : {}),
    ...(search.aggs ? { aggs: search.aggs } : {}),
    limit: search.limit,
    ...(search.page && search.page > 1 ? { page: search.page } : {}),
  };
}

export function paramsPath(base: string, params: Clause): string {
  const path = `${base}?params=${encodeURIComponent(JSON.stringify(params))}`;
  if (path.length > MAX_REQUEST_PATH)
    throw new AicError("bad_request", "This search is too long.");
  return path;
}

const envelope = z.object({
  pagination: z
    .object({ total: z.number().int().nonnegative() })
    .partial()
    .nullish(),
  data: z.array(z.unknown()),
  aggregations: z.record(z.string(), z.unknown()).nullish(),
});

export interface RecordPage<T> {
  items: T[];
  total: number;
  page: number;
  /** Pages a visitor can reach inside the API's 1,000-result window. */
  totalPages: number;
  aggregations: Record<string, unknown>;
}

/** Validates each record on its own, so one bad record can't take down the page. */
export function toRecordPage<T extends z.ZodType>(
  json: unknown,
  item: T,
  limit: number,
  page = 1,
): RecordPage<z.infer<T>> {
  const parsed = envelope.safeParse(json);
  if (!parsed.success)
    throw new AicError(
      "invalid_response",
      "The museum API sent an unexpected list.",
    );
  const total = parsed.data.pagination?.total ?? parsed.data.data.length;
  return {
    items: parsed.data.data.flatMap((record) => {
      const result = item.safeParse(record);
      return result.success ? [result.data as z.infer<T>] : [];
    }),
    total,
    page,
    totalPages:
      limit > 0 ? Math.ceil(Math.min(total, MAX_SEARCH_RESULTS) / limit) : 0,
    aggregations: parsed.data.aggregations ?? {},
  };
}

export async function searchRecords<T extends z.ZodType>(
  resource: string,
  item: T,
  search: RecordSearch,
  revalidate: number = REVALIDATE_REFERENCE,
): Promise<RecordPage<z.infer<T>>> {
  const json = await aicGet(
    paramsPath(`/${resource}/search`, searchParamsFor(search)),
    { revalidate },
  );
  return toRecordPage(json, item, search.limit, search.page ?? 1);
}

/** One record, or null when the museum has no such record. */
export async function readRecord<T extends z.ZodType>(
  path: string,
  item: T,
  revalidate: number = REVALIDATE_REFERENCE,
): Promise<z.infer<T> | null> {
  let json: unknown;
  try {
    json = await aicGet(path, { revalidate });
  } catch (error) {
    if (isAicError(error) && error.code === "not_found") return null;
    throw error;
  }
  const parsed = z.object({ data: z.unknown() }).safeParse(json);
  if (!parsed.success) return null;
  const record = item.safeParse(parsed.data.data);
  return record.success ? (record.data as z.infer<T>) : null;
}

/**
 * Records by id, in the order given. For optional parts of a page: a failure gives an
 * empty list.
 */
export async function readByIds<T extends z.ZodType>(
  resource: string,
  ids: readonly (string | number)[],
  item: T,
  fields: string,
): Promise<z.infer<T>[]> {
  if (ids.length === 0) return [];
  try {
    const json = await aicGet(
      `/${resource}?ids=${ids.join(",")}&limit=${ids.length}&fields=${fields}`,
      { revalidate: REVALIDATE_REFERENCE, timeoutMs: 5000, retries: 1 },
    );
    const { items } = toRecordPage(json, item, ids.length);
    const order = new Map(ids.map((id, index) => [String(id), index]));
    const position = (record: unknown) =>
      order.get(String((record as { id?: unknown }).id)) ?? ids.length;
    return [...items].sort((a, b) => position(a) - position(b));
  } catch {
    return [];
  }
}

/** Numeric record id from a URL. Catalogue sections run to 11 digits. */
export function parseRecordId(value: string | undefined | null): number | null {
  if (!value || !/^\d{1,14}$/.test(value)) return null;
  const id = Number(value);
  return id > 0 && Number.isSafeInteger(id) ? id : null;
}

/* Text --------------------------------------------------------------------------------- */

export interface BodySection {
  heading: string | null;
  paragraphs: TextRun[][];
}

const plainRun = (text: string): TextRun[] => [{ text, italic: false }];

/**
 * The API's `copy` field: HTML in some resources, and in the rest plain text whose
 * paragraphs are separated by runs of three or more spaces.
 */
export function parseCopy(copy: string | null | undefined): TextRun[][] | null {
  if (!copy?.trim()) return null;
  if (/<(p|div|ul|ol|li|h[1-6])\b/i.test(copy))
    return parseDescription(
      copy
        .replace(/<h1\b[^>]*>[\s\S]*?<\/h1>/gi, "")
        .replace(/<\/?h[2-6]\b[^>]*>/gi, "<p>"),
      LONG_TEXT,
    );
  const paragraphs = decodeEntities(copy)
    .split(/\s{3,}/)
    .map((paragraph) => paragraph.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .slice(0, LONG_TEXT.maxParagraphs);
  return paragraphs.length > 0 ? paragraphs.map(plainRun) : null;
}

const SECTION_HEADINGS: Record<string, string | null> = {
  tombstone: null,
  curatorial_entry: null,
  technical_report: "Technical Report",
  provenance: "Provenance",
  exhibitions: "Exhibition History",
  references: "References",
  other_documentation: "Other Documentation",
};

function headingFor(name: string): string | null {
  if (name in SECTION_HEADINGS) return SECTION_HEADINGS[name] ?? null;
  const words = name.replace(/[_-]+/g, " ").trim();
  return words ? words.charAt(0).toUpperCase() + words.slice(1) : null;
}

/** A catalogue entry: <section> blocks of plain text, split by blank lines. */
export function parseCatalogueEntry(
  content: string | null | undefined,
): BodySection[] {
  if (!content) return [];
  const sections: BodySection[] = [];
  const pattern = /<section\b([^>]*)>([\s\S]*?)<\/section>/gi;
  for (const match of content.matchAll(pattern)) {
    const classes = /class="([^"]*)"/.exec(match[1] ?? "")?.[1] ?? "";
    const name = classes.split(/\s+/).filter(Boolean).at(-1) ?? "";
    const lineBreaks = name === "tombstone" ? /\r?\n/ : /(?:\r?\n){2,}/;
    const paragraphs = decodeEntities((match[2] ?? "").replace(/<[^>]+>/g, ""))
      .split(lineBreaks)
      .map((line) => line.replace(/\s+/g, " ").trim())
      .filter(Boolean)
      .map(plainRun);
    if (paragraphs.length > 0)
      sections.push({ heading: headingFor(name), paragraphs });
  }
  return sections;
}

export function excerpt(
  paragraphs: TextRun[][] | null,
  max = 190,
): string | null {
  const text = paragraphs?.[0]
    ?.map((run) => run.text)
    .join("")
    .trim();
  if (!text) return null;
  if (text.length <= max) return text;
  const cut = text.slice(0, max);
  return `${cut.slice(0, Math.max(cut.lastIndexOf(" "), max - 30)).trimEnd()}…`;
}

const SMALL_WORDS = new Set([
  "a",
  "an",
  "and",
  "at",
  "for",
  "in",
  "of",
  "on",
  "the",
  "to",
]);

/** "chicagos-home-for-the-holidays-105" → "Chicagos Home for the Holidays". */
export function readableSlug(value: string): string {
  if (!/^[a-z0-9-]+$/.test(value)) return value;
  return value
    .replace(/-\d+$/, "")
    .split("-")
    .filter(Boolean)
    .map((word, index) =>
      index > 0 && SMALL_WORDS.has(word)
        ? word
        : word.charAt(0).toUpperCase() + word.slice(1),
    )
    .join(" ");
}

/** "Garfield_Park_Exhibition_[5706].pdf" → "Garfield Park Exhibition". */
export function cleanFileTitle(value: string): string {
  return value
    .replace(/\.(pdf|mp3|mp4)$/i, "")
    .replace(/\s*\[\d+\]\s*$/, "")
    .replace(/_+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/* Links and images ----------------------------------------------------------------------- */

function parseUrl(value: string | null | undefined): URL | null {
  if (typeof value !== "string") return null;
  try {
    return new URL(value);
  } catch {
    return null;
  }
}

/** Links to the museum's own sites (www, shop, publications, archive, sales…). */
export function articUrl(value: string | null | undefined): string | null {
  const url = parseUrl(value);
  if (!url || (url.protocol !== "https:" && url.protocol !== "http:"))
    return null;
  const host = url.hostname;
  return host === "artic.edu" || host.endsWith(".artic.edu")
    ? url.toString()
    : null;
}

/** Any web address, for the museum's microsites, some of which live elsewhere. */
export function webUrl(value: string | null | undefined): string | null {
  const url = parseUrl(value);
  return url && (url.protocol === "https:" || url.protocol === "http:")
    ? url.toString()
    : null;
}

const IMAGE_HOSTS = new Set(["artic-web.imgix.net", "shop-images.imgix.net"]);

/** A museum web image at `width`, keeping the crop's proportions. */
export function imgixUrl(
  value: string | null | undefined,
  width: number,
): string | null {
  const url = parseUrl(value);
  if (!url || url.protocol !== "https:" || !IMAGE_HOSTS.has(url.hostname))
    return null;
  const oldWidth = Number(url.searchParams.get("w"));
  const oldHeight = Number(url.searchParams.get("h"));
  url.searchParams.set("w", String(width));
  if (oldWidth > 0 && oldHeight > 0)
    url.searchParams.set(
      "h",
      String(Math.round((oldHeight * width) / oldWidth)),
    );
  url.searchParams.set("auto", "format,compress");
  return url.toString();
}
