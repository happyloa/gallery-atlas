/**
 * Audio tours. Which stops make up a tour comes from the generated index; titles, audio and
 * transcripts come from the documented API, so they stay current between index updates.
 * Works are only shown when the museum marks them public domain, as everywhere on the site.
 */
import { z } from "zod";
import type {
  Artwork,
  Tour,
  TourRecording,
  TourStop,
  TourSummary,
} from "@/lib/artwork/types";
import { getArtworksByIds } from "./artworks";
import { aicGet, isAicError } from "./client";
import { REVALIDATE_ARTWORK, REVALIDATE_REFERENCE } from "./config";
import { parseDescription } from "./description";
import { museumUrl, plainTitle } from "./museum";
import { TOUR_INDEX } from "./tour-index";
import type { TourEntry } from "./tour-types";

/** Transcripts run longer than descriptions and must not be cut off. */
const TRANSCRIPT_LIMITS = { maxParagraphs: 400, maxChars: 40_000 };
const COVER_CANDIDATES = 4;

const text = z.string().nullish().catch(null);
const rawTour = z.object({
  id: z.number().int().positive(),
  title: text,
  description: text,
  intro: text,
});
const rawSound = z.object({
  id: z.number().int().positive(),
  title: text,
  web_url: text,
  transcript: text,
});
const rawLocation = z.object({
  id: z.number().int().positive(),
  is_on_view: z.boolean().nullish().catch(null),
  gallery_id: z.number().int().nullish().catch(null),
  gallery_title: text,
});

function records<T extends z.ZodType>(json: unknown, item: T): z.infer<T>[] {
  const data = z.object({ data: z.array(z.unknown()) }).safeParse(json);
  if (!data.success) return [];
  return data.data.data.flatMap((record) => {
    const parsed = item.safeParse(record);
    return parsed.success ? [parsed.data as z.infer<T>] : [];
  });
}

const TOUR_FIELDS = "id,title,description,intro";

function toSummary(
  entry: TourEntry,
  raw: z.infer<typeof rawTour>,
  cover: Artwork | null,
): TourSummary | null {
  const title = plainTitle(raw.title, 200);
  if (!title) return null;
  const ids = [entry.intro, ...entry.stops.map((s) => s.sound)];
  return {
    id: entry.id,
    title,
    zhTitle: entry.zhTitle,
    description: parseDescription(raw.description),
    zhDescription: entry.zhDescription,
    minutes: entry.minutes,
    stopCount: entry.stops.length,
    hasChinese: ids.some((id) => id && TOUR_INDEX.sounds[id]),
    cover,
  };
}

/** Every tour, in the museum's own order, each with a public-domain cover if it has one. */
export async function getTourSummaries(): Promise<TourSummary[]> {
  const json = await aicGet(`/tours?limit=100&fields=${TOUR_FIELDS}`, {
    revalidate: REVALIDATE_REFERENCE,
  });
  const byId = new Map(records(json, rawTour).map((tour) => [tour.id, tour]));
  const candidates = (entry: TourEntry) =>
    entry.stops
      .flatMap((s) => (s.artwork ? [s.artwork] : []))
      .slice(0, COVER_CANDIDATES);
  const read = await getArtworksByIds(TOUR_INDEX.tours.flatMap(candidates), {
    timeoutMs: 6000,
    retries: 1,
  }).catch(() => null);
  const works = new Map(read?.artworks.map((a) => [a.id, a]) ?? []);

  return TOUR_INDEX.tours.flatMap((entry) => {
    const raw = byId.get(entry.id);
    if (!raw) return [];
    const cover =
      candidates(entry)
        .map((id) => works.get(id))
        .find(Boolean) ?? null;
    const summary = toSummary(entry, raw, cover);
    return summary ? [summary] : [];
  });
}

async function readSounds(ids: readonly number[]) {
  if (ids.length === 0) return new Map<number, z.infer<typeof rawSound>>();
  const json = await aicGet(
    `/mobile-sounds?ids=${ids.join(",")}&limit=100&fields=id,title,web_url,transcript`,
    { revalidate: REVALIDATE_REFERENCE },
  );
  return new Map(records(json, rawSound).map((sound) => [sound.id, sound]));
}

function toRecording(
  soundId: number,
  raw: z.infer<typeof rawSound> | undefined,
  title: string | null,
): TourRecording | null {
  const src = museumUrl(raw?.web_url);
  const chinese = TOUR_INDEX.sounds[soundId];
  if (!src && !chinese) return null;
  return {
    soundId,
    title: title ?? plainTitle(raw?.title, 200) ?? "",
    src,
    zhSrc: chinese?.zhSrc ?? null,
    zhTitle: chinese?.zhTitle ?? null,
    transcript: parseDescription(raw?.transcript, TRANSCRIPT_LIMITS),
  };
}

/** Where each work hangs right now. Extra, so a failure just leaves the rooms out. */
async function readLocations(ids: readonly number[]) {
  const rooms = new Map<number, { id: number | null; name: string }>();
  if (ids.length === 0) return rooms;
  try {
    const json = await aicGet(
      `/artworks?ids=${ids.join(",")}&limit=100&fields=id,is_on_view,gallery_id,gallery_title`,
      { revalidate: REVALIDATE_ARTWORK, timeoutMs: 5000, retries: 1 },
    );
    for (const work of records(json, rawLocation)) {
      const name = plainTitle(work.gallery_title, 120);
      if (work.is_on_view === true && name)
        rooms.set(work.id, { id: work.gallery_id ?? null, name });
    }
  } catch {
    // Rooms are a detail; the tour still plays without them.
  }
  return rooms;
}

export type TourLookup = { status: "ok"; tour: Tour } | { status: "not_found" };

export async function getTour(id: number): Promise<TourLookup> {
  const entry = TOUR_INDEX.tours.find((tour) => tour.id === id);
  if (!entry) return { status: "not_found" };

  let json: unknown;
  try {
    json = await aicGet(`/tours/${id}?fields=${TOUR_FIELDS}`, {
      revalidate: REVALIDATE_REFERENCE,
    });
  } catch (error) {
    if (isAicError(error) && error.code === "not_found")
      return { status: "not_found" };
    throw error;
  }
  const raw = rawTour.safeParse((json as { data?: unknown } | null)?.data);
  if (!raw.success) return { status: "not_found" };

  const artworkIds = [
    ...new Set(entry.stops.flatMap((s) => (s.artwork ? [s.artwork] : []))),
  ];
  const [sounds, read, rooms] = await Promise.all([
    readSounds([
      ...(entry.intro ? [entry.intro] : []),
      ...entry.stops.map((s) => s.sound),
    ]),
    getArtworksByIds(artworkIds),
    readLocations(artworkIds),
  ]);
  const works = new Map(read.artworks.map((a) => [a.id, a]));

  const stops: TourStop[] = [];
  for (const stop of entry.stops) {
    const recording = toRecording(
      stop.sound,
      sounds.get(stop.sound),
      stop.title,
    );
    if (!recording) continue;
    stops.push({
      ...recording,
      number: stops.length + 1,
      code: stop.code,
      artwork: stop.artwork ? (works.get(stop.artwork) ?? null) : null,
      gallery: stop.artwork ? (rooms.get(stop.artwork) ?? null) : null,
    });
  }

  const cover = stops.find((stop) => stop.artwork)?.artwork ?? null;
  const summary = toSummary(entry, raw.data, cover);
  if (!summary) return { status: "not_found" };
  return {
    status: "ok",
    tour: {
      ...summary,
      intro: parseDescription(raw.data.intro),
      introRecording: entry.intro
        ? toRecording(entry.intro, sounds.get(entry.intro), null)
        : null,
      stops,
    },
  };
}

export interface ArtworkAudio {
  recordings: (TourRecording & { code: string | null })[];
  tours: { id: number; title: string; zhTitle: string | null }[];
}

/** The audio guide recordings about one work, and the tours it is part of. */
export async function getArtworkAudio(
  artworkId: number,
): Promise<ArtworkAudio> {
  const entries = TOUR_INDEX.commentary[artworkId] ?? [];
  const tourEntries = TOUR_INDEX.tours.filter((tour) =>
    tour.stops.some((stop) => stop.artwork === artworkId),
  );
  if (entries.length === 0 && tourEntries.length === 0)
    return { recordings: [], tours: [] };
  try {
    const [sounds, list] = await Promise.all([
      readSounds(entries.map((e) => e.sound)),
      tourEntries.length > 0
        ? aicGet(`/tours?limit=100&fields=${TOUR_FIELDS}`, {
            revalidate: REVALIDATE_REFERENCE,
            timeoutMs: 5000,
            retries: 1,
          })
        : null,
    ]);
    const titles = new Map(
      records(list, rawTour).map((t) => [t.id, plainTitle(t.title, 200)]),
    );
    return {
      recordings: entries.flatMap((entry) => {
        const recording = toRecording(
          entry.sound,
          sounds.get(entry.sound),
          entry.title ?? "",
        );
        return recording ? [{ ...recording, code: entry.code }] : [];
      }),
      tours: tourEntries.flatMap((tour) => {
        const title = titles.get(tour.id);
        return title ? [{ id: tour.id, title, zhTitle: tour.zhTitle }] : [];
      }),
    };
  } catch {
    return { recordings: [], tours: [] };
  }
}
