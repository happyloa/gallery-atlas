/**
 * The rest of the museum's API that the site reads: audio recordings, galleries, the
 * museum's own exhibitions, articles and publications, search suggestions, a random or
 * daily work, and place-of-origin counts. Server only, like the rest of lib/artic.
 */
import { z } from "zod";
import type {
  Gallery,
  MuseumExhibition,
  ReadingItem,
  Sound,
} from "@/lib/artwork/types";
import { aicGet, isAicError } from "./client";
import type { AicRequestOptions } from "./client";
import {
  EXHIBITIONS_PAGE_SIZE,
  MAX_READING,
  MAX_SOUNDS,
  PLACE_FIELD,
  REVALIDATE_ARTWORK,
  REVALIDATE_REFERENCE,
  museumArticleUrl,
} from "./config";
import { parseDescription } from "./description";
import { DISPLAYABLE } from "./filters";

type RequestOptions = Omit<AicRequestOptions, "revalidate">;

const text = z.string().nullish().catch(null);

/** Strips tags and tidies whitespace in short upstream titles (some carry <em>). */
export function plainTitle(
  value: string | null | undefined,
  max = 200,
): string | null {
  if (typeof value !== "string") return null;
  const cleaned = value
    .replace(/<[^>]*>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/\s+/g, " ")
    .trim();
  if (!cleaned) return null;
  return cleaned.length > max
    ? `${cleaned.slice(0, max - 1).trimEnd()}…`
    : cleaned;
}

/** Only https URLs on the museum's own site are linked or played. */
function museumUrl(value: string | null | undefined): string | null {
  if (typeof value !== "string") return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" && url.hostname === "www.artic.edu"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

const list = <T extends z.ZodType>(item: T) =>
  z
    .object({
      pagination: z
        .object({ total: z.number().int().nonnegative() })
        .partial()
        .nullish(),
      data: z.array(z.unknown()),
    })
    .transform((value) => ({
      total: value.pagination?.total ?? value.data.length,
      items: value.data.flatMap((record) => {
        const parsed = item.safeParse(record);
        return parsed.success ? [parsed.data as z.infer<T>] : [];
      }),
    }));

const detail = z.object({ data: z.unknown() });

/* Audio ------------------------------------------------------------------------------ */

const rawSound = z.object({ id: z.string(), title: text, content: text });

/** "Audio stop 781.mp3" is a numbered stop in the museum's audio guide. */
const STOP = /^audio stop (\d{1,5})(?:\.mp3)?$/i;

export function toSound(raw: z.infer<typeof rawSound>): Sound | null {
  const src = museumUrl(raw.content);
  if (!src) return null;
  const title = plainTitle(raw.title)?.replace(/\.mp3$/i, "") ?? "";
  const stop = STOP.exec(plainTitle(raw.title) ?? "");
  return {
    id: raw.id,
    title,
    stop: stop ? Number(stop[1]) : null,
    src,
  };
}

/** The recordings linked to a work. Extra, so a failure gives an empty list. */
export async function getSounds(ids: readonly string[]): Promise<Sound[]> {
  if (ids.length === 0) return [];
  try {
    const json = await aicGet(
      `/sounds?ids=${ids.slice(0, MAX_SOUNDS).join(",")}&fields=id,title,content`,
      { revalidate: REVALIDATE_REFERENCE, timeoutMs: 5000, retries: 1 },
    );
    const parsed = list(rawSound).safeParse(json);
    if (!parsed.success) return [];
    return parsed.data.items.flatMap((raw) => {
      const sound = toSound(raw);
      return sound ? [sound] : [];
    });
  } catch {
    return [];
  }
}

/* Galleries -------------------------------------------------------------------------- */

const rawGallery = z.object({
  id: z.number().int(),
  title: text,
  number: text,
  floor: text,
  is_closed: z.boolean().nullish().catch(null),
});

export type GalleryLookup =
  { status: "ok"; gallery: Gallery } | { status: "not_found" };

export async function getGallery(
  id: number,
  options: RequestOptions = {},
): Promise<GalleryLookup> {
  let json: unknown;
  try {
    json = await aicGet(
      `/galleries/${id}?fields=id,title,number,floor,is_closed`,
      {
        ...options,
        revalidate: REVALIDATE_REFERENCE,
      },
    );
  } catch (error) {
    if (isAicError(error) && error.code === "not_found")
      return { status: "not_found" };
    throw error;
  }
  const raw = rawGallery.safeParse(detail.parse(json).data);
  const name = raw.success ? plainTitle(raw.data.title, 120) : null;
  if (!raw.success || !name) return { status: "not_found" };
  return {
    status: "ok",
    gallery: {
      id: raw.data.id,
      name,
      number: plainTitle(raw.data.number, 20),
      floor: plainTitle(raw.data.floor, 20),
      isClosed: raw.data.is_closed === true,
    },
  };
}

/* Museum exhibitions ----------------------------------------------------------------- */

const EXHIBITION_FIELDS =
  "id,title,short_description,web_url,aic_start_at,aic_end_at,gallery_id,gallery_title,artwork_ids";

const rawExhibition = z.object({
  id: z.number().int().positive(),
  title: text,
  short_description: text,
  web_url: text,
  aic_start_at: text,
  aic_end_at: text,
  gallery_id: z.number().int().nullish().catch(null),
  gallery_title: text,
  artwork_ids: z.array(z.unknown()).nullish().catch(null),
});

const isoDate = (value: string | null | undefined) =>
  typeof value === "string" && /^\d{4}-\d{2}-\d{2}/.test(value)
    ? value.slice(0, 10)
    : null;

export function toExhibition(
  raw: z.infer<typeof rawExhibition>,
): MuseumExhibition | null {
  const title = plainTitle(raw.title, 200);
  if (!title) return null;
  const galleryName = plainTitle(raw.gallery_title, 120);
  return {
    id: raw.id,
    title,
    summary: parseDescription(raw.short_description),
    start: isoDate(raw.aic_start_at),
    end: isoDate(raw.aic_end_at),
    gallery: galleryName
      ? { id: raw.gallery_id ?? null, name: galleryName }
      : null,
    artworkIds: [
      ...new Set(
        (raw.artwork_ids ?? []).filter(
          (id): id is number => Number.isInteger(id) && (id as number) > 0,
        ),
      ),
    ],
    sourceUrl:
      museumUrl(raw.web_url) ?? `https://www.artic.edu/exhibitions/${raw.id}`,
  };
}

/** Where an exhibition stands on `today` (YYYY-MM-DD). */
export function exhibitionStatus(
  exhibition: Pick<MuseumExhibition, "start" | "end">,
  today: string,
): "upcoming" | "current" | "past" | null {
  if (exhibition.start && today < exhibition.start) return "upcoming";
  if (exhibition.end && today > exhibition.end) return "past";
  if (exhibition.start || exhibition.end) return "current";
  return null;
}

/** Exhibitions that list works, newest first. */
export async function getMuseumExhibitions(
  page: number,
  options: RequestOptions = {},
): Promise<{
  exhibitions: MuseumExhibition[];
  total: number;
  totalPages: number;
}> {
  const params = {
    query: { bool: { filter: [{ exists: { field: "artwork_ids" } }] } },
    sort: [{ aic_start_at: "desc" }],
    fields: EXHIBITION_FIELDS,
    limit: EXHIBITIONS_PAGE_SIZE,
    page,
  };
  const json = await aicGet(
    `/exhibitions/search?params=${encodeURIComponent(JSON.stringify(params))}`,
    { ...options, revalidate: REVALIDATE_REFERENCE },
  );
  const parsed = list(rawExhibition).parse(json);
  // The search window is 1,000 results, like artworks.
  const reachable = Math.min(parsed.total, 1000);
  return {
    exhibitions: parsed.items.flatMap((raw) => {
      const exhibition = toExhibition(raw);
      return exhibition ? [exhibition] : [];
    }),
    total: parsed.total,
    totalPages: Math.ceil(reachable / EXHIBITIONS_PAGE_SIZE),
  };
}

export type ExhibitionLookup =
  { status: "ok"; exhibition: MuseumExhibition } | { status: "not_found" };

export async function getMuseumExhibition(
  id: number,
  options: RequestOptions = {},
): Promise<ExhibitionLookup> {
  let json: unknown;
  try {
    json = await aicGet(`/exhibitions/${id}?fields=${EXHIBITION_FIELDS}`, {
      ...options,
      revalidate: REVALIDATE_REFERENCE,
    });
  } catch (error) {
    if (isAicError(error) && error.code === "not_found")
      return { status: "not_found" };
    throw error;
  }
  const raw = rawExhibition.safeParse(detail.parse(json).data);
  const exhibition = raw.success ? toExhibition(raw.data) : null;
  return exhibition ? { status: "ok", exhibition } : { status: "not_found" };
}

/* Further reading -------------------------------------------------------------------- */

const rawArticle = z.object({ id: z.number().int().positive(), title: text });
const rawPublication = z.object({
  id: z.number().int().positive(),
  title: text,
  web_url: text,
});

/**
 * Articles and digital publications that mention `topic` (an artist's name, usually).
 * Titles and links only: the texts themselves stay on artic.edu. Extra, so failures
 * give an empty list.
 */
export async function getFurtherReading(topic: string): Promise<ReadingItem[]> {
  const q = encodeURIComponent(topic.slice(0, 100));
  const request = {
    revalidate: REVALIDATE_REFERENCE,
    timeoutMs: 5000,
    retries: 1,
  };
  const [articles, publications] = await Promise.allSettled([
    aicGet(
      `/articles/search?q=${q}&limit=${MAX_READING}&fields=id,title`,
      request,
    ),
    aicGet(
      `/digital-publications/search?q=${q}&limit=2&fields=id,title,web_url`,
      request,
    ),
  ]);
  const items: ReadingItem[] = [];
  if (articles.status === "fulfilled") {
    const parsed = list(rawArticle).safeParse(articles.value);
    for (const raw of parsed.success ? parsed.data.items : []) {
      const title = plainTitle(raw.title, 160);
      if (title)
        items.push({ kind: "article", title, url: museumArticleUrl(raw.id) });
    }
  }
  if (publications.status === "fulfilled") {
    const parsed = list(rawPublication).safeParse(publications.value);
    for (const raw of parsed.success ? parsed.data.items : []) {
      const title = plainTitle(raw.title, 160);
      const url = museumUrl(raw.web_url);
      if (title && url) items.push({ kind: "publication", title, url });
    }
  }
  return items.slice(0, MAX_READING + 1);
}

/* Suggestions ------------------------------------------------------------------------ */

/** Titles and artist names that start like `prefix`, for the search box. */
export async function getSuggestions(prefix: string): Promise<string[]> {
  const q = prefix.replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 2) return [];
  try {
    const json = await aicGet(
      `/autocomplete?q=${encodeURIComponent(q)}&resources=artworks,agents`,
      { revalidate: REVALIDATE_REFERENCE, timeoutMs: 3000, retries: 0 },
    );
    const parsed = z.array(z.unknown()).safeParse(json);
    if (!parsed.success) return [];
    const seen = new Set<string>();
    return parsed.data
      .flatMap((value) => {
        const title = typeof value === "string" ? plainTitle(value, 120) : null;
        if (!title || seen.has(title.toLowerCase())) return [];
        seen.add(title.toLowerCase());
        return [title];
      })
      .slice(0, 8);
  } catch {
    return [];
  }
}

/* Random and daily works ------------------------------------------------------------- */

const idList = z.object({
  pagination: z.object({ total: z.number().int().nonnegative() }).partial().nullish(),
  data: z.array(z.object({ id: z.number().int().positive() })),
});

async function searchIds(
  params: Record<string, unknown>,
  revalidate: number,
): Promise<{ ids: number[]; total: number } | null> {
  const json = await aicGet(
    `/artworks/search?params=${encodeURIComponent(JSON.stringify(params))}`,
    { revalidate, timeoutMs: 5000, retries: 1 },
  );
  const parsed = idList.safeParse(json);
  if (!parsed.success) return null;
  return {
    ids: parsed.data.data.map((record) => record.id),
    total: parsed.data.pagination?.total ?? parsed.data.data.length,
  };
}

/**
 * The museum's search ranks by its own popularity boost and ignores `random_score`
 * (checked 2026-11-18: every seed returned The Bedroom first). So randomness comes from
 * here instead: a random point in the id range, then a random pick near it.
 */
const RANDOM_POOL = [...DISPLAYABLE, { exists: { field: "description" } }];
const NEAR = 20;

/** Lowest and highest id in the pool, cached for a day. */
async function idRange(pool: unknown[]): Promise<{ min: number; max: number } | null> {
  const edge = (order: "asc" | "desc") =>
    searchIds(
      { query: { bool: { filter: pool } }, sort: [{ id: order }], fields: "id", limit: 1 },
      REVALIDATE_REFERENCE,
    );
  const [low, high] = await Promise.all([edge("asc"), edge("desc")]);
  const min = low?.ids[0];
  const max = high?.ids[0];
  return min !== undefined && max !== undefined ? { min, max } : null;
}

/** A random public-domain work the museum has written about. */
export async function getRandomArtworkId(
  random: () => number = Math.random,
): Promise<number | null> {
  const range = await idRange(RANDOM_POOL);
  if (!range) return null;
  const cursor = range.min + Math.floor(random() * (range.max - range.min + 1));
  // Uncached: each cursor is new, and a cache entry per visit would only pile up.
  const after = await searchIds(
    {
      query: { bool: { filter: [...RANDOM_POOL, { range: { id: { gte: cursor } } }] } },
      sort: [{ id: "asc" }],
      fields: "id",
      limit: NEAR,
    },
    0,
  );
  const near = after?.ids.length
    ? after
    : await searchIds(
        {
          query: { bool: { filter: [...RANDOM_POOL, { range: { id: { lt: cursor } } }] } },
          sort: [{ id: "desc" }],
          fields: "id",
          limit: NEAR,
        },
        0,
      );
  const ids = near?.ids ?? [];
  return ids[Math.floor(random() * ids.length)] ?? null;
}

/** Days since 1970-01-01 (UTC) for `date`: the same number all day, everywhere. */
export function dayNumber(date: Date): number {
  return Math.floor(date.getTime() / 86_400_000);
}

/** Spreads consecutive days across the list, so neighbouring ids don't follow each other. */
function scatter(day: number): number {
  let h = Math.imul(day ^ 0x9e3779b9, 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return (h ^ (h >>> 16)) >>> 0;
}

const DAILY_POOL = [...DISPLAYABLE, { term: { is_boosted: true } }];

/** One of the museum's highlighted works, the same one for everybody all day (UTC). */
export async function getWorkOfTheDayId(date: Date): Promise<number | null> {
  try {
    const count = await searchIds(
      { query: { bool: { filter: DAILY_POOL } }, fields: "id", limit: 0 },
      REVALIDATE_REFERENCE,
    );
    const total = Math.min(count?.total ?? 0, 1000);
    if (total === 0) return null;
    const pick = await searchIds(
      {
        query: { bool: { filter: DAILY_POOL } },
        sort: [{ id: "asc" }],
        fields: "id",
        limit: 1,
        page: (scatter(dayNumber(date)) % total) + 1,
      },
      REVALIDATE_ARTWORK,
    );
    return pick?.ids[0] ?? null;
  } catch {
    return null;
  }
}

/* Places ----------------------------------------------------------------------------- */

const placeBuckets = z.object({
  aggregations: z.object({
    places: z.object({
      buckets: z.array(
        z.object({ key: z.string(), doc_count: z.number().int() }),
      ),
    }),
  }),
});

/** Displayable works per place of origin (lowercase keys), most common first. */
export async function getPlaceCounts(): Promise<Map<string, number> | null> {
  const params = {
    query: { bool: { filter: DISPLAYABLE } },
    limit: 0,
    aggs: { places: { terms: { field: PLACE_FIELD, size: 80 } } },
  };
  try {
    const json = await aicGet(
      `/artworks/search?params=${encodeURIComponent(JSON.stringify(params))}`,
      { revalidate: REVALIDATE_REFERENCE, timeoutMs: 6000, retries: 1 },
    );
    const parsed = placeBuckets.safeParse(json);
    if (!parsed.success) return null;
    return new Map(
      parsed.data.aggregations.places.buckets.map((b) => [
        b.key.toLowerCase(),
        b.doc_count,
      ]),
    );
  } catch {
    return null;
  }
}
