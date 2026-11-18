/**
 * The rest of the museum's API that the site reads: audio recordings, galleries, the
 * museum's own exhibitions, articles and publications, search suggestions, a random or
 * daily work, and place-of-origin counts. Server only, like the rest of lib/artic.
 */
import { z } from "zod";
import type {
  Artwork,
  Gallery,
  MuseumExhibition,
  ReadingItem,
  Sound,
} from "@/lib/artwork/types";
import { reportUpstreamFailure } from "@/lib/render-health";
import {
  aicGet,
  invalidResponse,
  isAicError,
  pastSearchWindow,
} from "./client";
import type { AicRequestOptions } from "./client";
import {
  ARTWORK_FIELDS,
  EXHIBITIONS_PAGE_SIZE,
  MAX_READING,
  MAX_SEARCH_RESULTS,
  MAX_SOUNDS,
  maxPageFor,
  PLACE_FIELD,
  REVALIDATE_LISTING,
  REVALIDATE_REFERENCE,
  museumArticleUrl,
} from "./config";
import { parseDescription } from "./description";
import { DISPLAYABLE } from "./filters";
import { resolveIiifBase } from "./images";
import { toArtworks } from "./mapper";
import { searchResponseSchema } from "./schema";

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
export function museumUrl(value: string | null | undefined): string | null {
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

/** The record inside a single-record response. */
function recordOf(json: unknown, what: string): unknown {
  const parsed = detail.safeParse(json);
  if (!parsed.success) throw invalidResponse(what);
  return parsed.data.data;
}

/**
 * Reads one record with `schema`. A record that is there but cannot be read is treated as
 * missing by the callers, and reported, since "missing" is then only a guess.
 */
function readAs<T extends z.ZodType>(
  json: unknown,
  what: string,
  schema: T,
): z.infer<T> | null {
  const raw = schema.safeParse(recordOf(json, what));
  if (raw.success) return raw.data as z.infer<T>;
  reportUpstreamFailure();
  return null;
}

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

/**
 * The recordings linked to a work. Extra, so a failure gives an empty list. Not kept in
 * the data cache: the ids are different for every work.
 */
export async function getSounds(ids: readonly string[]): Promise<Sound[]> {
  if (ids.length === 0) return [];
  try {
    const json = await aicGet(
      `/sounds?ids=${ids.slice(0, MAX_SOUNDS).join(",")}&fields=id,title,content`,
      { timeoutMs: 5000, retries: 1 },
    );
    const parsed = list(rawSound).safeParse(json);
    if (!parsed.success) {
      reportUpstreamFailure();
      return [];
    }
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
  const raw = readAs(json, "gallery", rawGallery);
  const gallery = raw ? toGallery(raw) : null;
  return gallery ? { status: "ok", gallery } : { status: "not_found" };
}

/** A gallery in the overview, with how many public-domain works hang there now. */
export interface GalleryListing extends Gallery {
  works: number;
}

const GALLERY_FIELDS = "id,title,number,floor,is_closed";

function toGallery(raw: z.infer<typeof rawGallery>): Gallery | null {
  const name = plainTitle(raw.title, 120);
  if (!name) return null;
  return {
    id: raw.id,
    name,
    number: plainTitle(raw.number, 20),
    floor: plainTitle(raw.floor, 20),
    isClosed: raw.is_closed === true,
  };
}

const galleryCounts = z.object({
  aggregations: z.object({
    galleries: z.object({
      buckets: z.array(
        z.object({ key: z.number(), doc_count: z.number().int() }),
      ),
    }),
  }),
});

/**
 * Every gallery in the building (179 when checked), with its count of public-domain works
 * on view. Two pages of galleries and one aggregation; the list is cached for a day and
 * the counts for an hour, since works rotate.
 */
export async function getGalleryOverview(): Promise<GalleryListing[]> {
  const page = (n: number) =>
    aicGet(`/galleries?limit=100&page=${n}&fields=${GALLERY_FIELDS}`, {
      revalidate: REVALIDATE_REFERENCE,
    });
  const countsParams = {
    query: {
      bool: { filter: [...DISPLAYABLE, { term: { is_on_view: true } }] },
    },
    limit: 0,
    aggs: { galleries: { terms: { field: "gallery_id", size: 300 } } },
  };
  const [first, second, counts] = await Promise.all([
    page(1),
    page(2),
    aicGet(
      `/artworks/search?params=${encodeURIComponent(JSON.stringify(countsParams))}`,
      { revalidate: REVALIDATE_LISTING },
    ),
  ]);
  const counted = galleryCounts.safeParse(counts);
  // Without counts every gallery would read "0 works": show them, but don't keep the page.
  if (!counted.success) reportUpstreamFailure();
  const works = new Map(
    (counted.data?.aggregations.galleries.buckets ?? []).map((b) => [
      b.key,
      b.doc_count,
    ]),
  );
  const seen = new Set<number>();
  const galleries: GalleryListing[] = [];
  for (const json of [first, second]) {
    const page = list(rawGallery).safeParse(json);
    if (!page.success) throw invalidResponse("gallery list");
    for (const raw of page.data.items) {
      const gallery = toGallery(raw);
      if (!gallery || seen.has(gallery.id)) continue;
      seen.add(gallery.id);
      galleries.push({ ...gallery, works: works.get(gallery.id) ?? 0 });
    }
  }
  return galleries;
}

/** Floors in building order; anything unexpected goes last. */
export const FLOORS = ["LL", "1", "2", "3"] as const;

/** Groups galleries by floor, numbered galleries in numeric order, named ones after. */
export function galleriesByFloor(
  galleries: readonly GalleryListing[],
): { floor: string | null; galleries: GalleryListing[] }[] {
  const groups = new Map<string | null, GalleryListing[]>();
  for (const gallery of galleries) {
    const floor =
      gallery.floor && FLOORS.includes(gallery.floor as (typeof FLOORS)[number])
        ? gallery.floor
        : null;
    groups.set(floor, [...(groups.get(floor) ?? []), gallery]);
  }
  const order = (a: GalleryListing, b: GalleryListing) => {
    const na = a.number
      ? Number.parseInt(a.number, 10)
      : Number.POSITIVE_INFINITY;
    const nb = b.number
      ? Number.parseInt(b.number, 10)
      : Number.POSITIVE_INFINITY;
    if (na !== nb) return na - nb;
    return (a.number ?? a.name).localeCompare(b.number ?? b.name, "en", {
      numeric: true,
    });
  };
  return [...FLOORS, null]
    .filter((floor) => groups.has(floor))
    .map((floor) => ({
      floor,
      galleries: [...(groups.get(floor) ?? [])].sort(order),
    }));
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

/** The last page of exhibitions inside the search window. */
export const MAX_EXHIBITIONS_PAGE = maxPageFor(EXHIBITIONS_PAGE_SIZE);

/** Exhibitions that list works, newest first. */
export async function getMuseumExhibitions(
  page: number,
  options: RequestOptions = {},
): Promise<{
  exhibitions: MuseumExhibition[];
  total: number;
  totalPages: number;
}> {
  // The search window is 1,000 results, like artworks.
  if (page > MAX_EXHIBITIONS_PAGE) throw pastSearchWindow();
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
  const parsed = list(rawExhibition).safeParse(json);
  if (!parsed.success) throw invalidResponse("exhibition list");
  return {
    exhibitions: parsed.data.items.flatMap((raw) => {
      const exhibition = toExhibition(raw);
      return exhibition ? [exhibition] : [];
    }),
    total: parsed.data.total,
    totalPages: Math.min(
      MAX_EXHIBITIONS_PAGE,
      Math.ceil(parsed.data.total / EXHIBITIONS_PAGE_SIZE),
    ),
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
  const raw = readAs(json, "exhibition", rawExhibition);
  const exhibition = raw ? toExhibition(raw) : null;
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
 * give an empty list. A keyword search, so not kept in the data cache.
 */
export async function getFurtherReading(topic: string): Promise<ReadingItem[]> {
  const q = encodeURIComponent(topic.slice(0, 100));
  const request = { timeoutMs: 5000, retries: 1 };
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
    if (!parsed.success) reportUpstreamFailure();
    for (const raw of parsed.success ? parsed.data.items : []) {
      const title = plainTitle(raw.title, 160);
      if (title)
        items.push({ kind: "article", title, url: museumArticleUrl(raw.id) });
    }
  }
  if (publications.status === "fulfilled") {
    const parsed = list(rawPublication).safeParse(publications.value);
    if (!parsed.success) reportUpstreamFailure();
    for (const raw of parsed.success ? parsed.data.items : []) {
      const title = plainTitle(raw.title, 160);
      const url = museumUrl(raw.web_url);
      if (title && url) items.push({ kind: "publication", title, url });
    }
  }
  return items.slice(0, MAX_READING + 1);
}

/* Suggestions ------------------------------------------------------------------------ */

/**
 * Titles and artist names that start like `prefix`, for the search box. Not kept in the
 * data cache: every few letters typed would be a write of their own.
 */
export async function getSuggestions(prefix: string): Promise<string[]> {
  const q = prefix.replace(/\s+/g, " ").trim().slice(0, 60);
  if (q.length < 2) return [];
  try {
    const json = await aicGet(
      `/autocomplete?q=${encodeURIComponent(q)}&resources=artworks,agents`,
      { timeoutMs: 3000, retries: 0 },
    );
    const parsed = z.array(z.unknown()).safeParse(json);
    if (!parsed.success) {
      reportUpstreamFailure();
      return [];
    }
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
  pagination: z
    .object({ total: z.number().int().nonnegative() })
    .partial()
    .nullish(),
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
  if (!parsed.success) {
    reportUpstreamFailure();
    return null;
  }
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
async function idRange(
  pool: unknown[],
): Promise<{ min: number; max: number } | null> {
  const edge = (order: "asc" | "desc") =>
    searchIds(
      {
        query: { bool: { filter: pool } },
        sort: [{ id: order }],
        fields: "id",
        limit: 1,
      },
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
      query: {
        bool: { filter: [...RANDOM_POOL, { range: { id: { gte: cursor } } }] },
      },
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
          query: {
            bool: {
              filter: [...RANDOM_POOL, { range: { id: { lt: cursor } } }],
            },
          },
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

/** Which highlighted work, counted in id order from 1, is the day's. Null when there are none. */
async function dailyPosition(date: Date): Promise<number | null> {
  const count = await searchIds(
    { query: { bool: { filter: DAILY_POOL } }, fields: "id", limit: 0 },
    REVALIDATE_REFERENCE,
  );
  const total = Math.min(count?.total ?? 0, MAX_SEARCH_RESULTS);
  return total === 0 ? null : (scatter(dayNumber(date)) % total) + 1;
}

const dailyParams = (position: number, fields: string) => ({
  query: { bool: { filter: DAILY_POOL } },
  sort: [{ id: "asc" }],
  fields,
  limit: 1,
  page: position,
});

/** One of the museum's highlighted works, the same one for everybody all day (UTC). */
export async function getWorkOfTheDayId(date: Date): Promise<number | null> {
  try {
    const position = await dailyPosition(date);
    if (position === null) return null;
    const pick = await searchIds(
      dailyParams(position, "id"),
      REVALIDATE_LISTING,
    );
    return pick?.ids[0] ?? null;
  } catch {
    return null;
  }
}

/**
 * The same pick as a record, read in the request that finds it, so the homepage does not
 * need a third round trip for the work itself. Null when the API can't name one.
 */
export async function getWorkOfTheDay(date: Date): Promise<Artwork | null> {
  try {
    const position = await dailyPosition(date);
    if (position === null) return null;
    const params = dailyParams(position, ARTWORK_FIELDS.join(","));
    const json = await aicGet(
      `/artworks/search?params=${encodeURIComponent(JSON.stringify(params))}`,
      { revalidate: REVALIDATE_LISTING, timeoutMs: 5000, retries: 1 },
    );
    const parsed = searchResponseSchema.safeParse(json);
    if (!parsed.success) {
      reportUpstreamFailure();
      return null;
    }
    const [artwork] = toArtworks(
      parsed.data.data,
      resolveIiifBase(parsed.data.config?.iiif_url),
    );
    return artwork ?? null;
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
    if (!parsed.success) {
      reportUpstreamFailure();
      return null;
    }
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
