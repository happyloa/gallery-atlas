/**
 * What is kept in localStorage, and how it is read back. Everything here is pure, so it can
 * be tested without a browser. Data from storage is never trusted: it may be missing,
 * corrupt, from an older version of the site, or edited by hand.
 */
// zod/mini: the same validation with a much smaller bundle, since this runs in the browser.
import * as z from "zod/mini";

export const STORAGE_KEY = "gallery-atlas:collection";
export const STORAGE_VERSION = 1;

export const MAX_FAVORITES = 500;
export const MAX_EXHIBITIONS = 10;
export const MAX_EXHIBITION_ITEMS = 100;
export const MAX_EXHIBITION_TITLE = 80;

export interface Favorite {
  id: number;
  savedAt: number;
}

export interface Exhibition {
  id: string;
  title: string;
  artworkIds: number[];
  createdAt: number;
  updatedAt: number;
}

export interface CollectionState {
  version: typeof STORAGE_VERSION;
  favorites: Favorite[];
  exhibitions: Exhibition[];
}

/** How the stored value was read: as-is, upgraded, repaired, or thrown away. */
export type ReadOutcome = "empty" | "ok" | "migrated" | "repaired" | "reset";

export const EMPTY_COLLECTION: CollectionState = Object.freeze({
  version: STORAGE_VERSION,
  favorites: Object.freeze([]) as unknown as Favorite[],
  exhibitions: Object.freeze([]) as unknown as Exhibition[],
}) as CollectionState;

const artworkId = z.int().check(z.positive(), z.maximum(999_999_999));
const timestamp = z.int().check(z.nonnegative());

const favoriteSchema = z.object({ id: artworkId, savedAt: timestamp });

const exhibitionSchema = z.object({
  id: z.string().check(z.minLength(1), z.maxLength(64)),
  title: z.string(),
  artworkIds: z.array(z.unknown()),
  createdAt: timestamp,
  updatedAt: timestamp,
});

const envelopeSchema = z.object({
  version: z.int(),
  favorites: z.optional(z.array(z.unknown())),
  exhibitions: z.optional(z.array(z.unknown())),
});

/** Trims and caps an exhibition title; empty titles are not allowed. */
export function cleanTitle(value: string): string {
  return Array.from(value.replace(/\s+/g, " ").trim())
    .slice(0, MAX_EXHIBITION_TITLE)
    .join("");
}

function uniqueIds(values: readonly unknown[], max: number): number[] {
  const seen = new Set<number>();
  for (const value of values) {
    const parsed = artworkId.safeParse(value);
    if (parsed.success) seen.add(parsed.data);
    if (seen.size >= max) break;
  }
  return [...seen];
}

/**
 * Validates favorites one by one: drops invalid entries and duplicate ids (the first save
 * wins), and caps the list. Returns whether anything had to be changed.
 */
function readFavorites(values: readonly unknown[]): {
  favorites: Favorite[];
  changed: boolean;
} {
  const favorites: Favorite[] = [];
  const seen = new Set<number>();
  for (const value of values) {
    const parsed = favoriteSchema.safeParse(value);
    if (!parsed.success || seen.has(parsed.data.id)) continue;
    seen.add(parsed.data.id);
    favorites.push(parsed.data);
    if (favorites.length >= MAX_FAVORITES) break;
  }
  return { favorites, changed: favorites.length !== values.length };
}

function readExhibitions(values: readonly unknown[]): {
  exhibitions: Exhibition[];
  changed: boolean;
} {
  const exhibitions: Exhibition[] = [];
  const seen = new Set<string>();
  let changed = false;
  for (const value of values) {
    const parsed = exhibitionSchema.safeParse(value);
    if (!parsed.success || seen.has(parsed.data.id)) {
      changed = true;
      continue;
    }
    const title = cleanTitle(parsed.data.title);
    if (!title) {
      changed = true;
      continue;
    }
    const artworkIds = uniqueIds(parsed.data.artworkIds, MAX_EXHIBITION_ITEMS);
    if (
      title !== parsed.data.title ||
      artworkIds.length !== parsed.data.artworkIds.length
    )
      changed = true;
    seen.add(parsed.data.id);
    exhibitions.push({ ...parsed.data, title, artworkIds });
    if (exhibitions.length >= MAX_EXHIBITIONS) break;
  }
  return {
    exhibitions,
    changed: changed || exhibitions.length !== values.length,
  };
}

/**
 * Reads the raw stored string. Never throws. Version 0 (a bare array of artwork ids, the
 * shape used before versioning) is upgraded; anything unreadable starts fresh.
 */
export function parseCollection(
  raw: string | null,
  now = Date.now(),
): { state: CollectionState; outcome: ReadOutcome } {
  if (raw === null || raw === "")
    return { state: EMPTY_COLLECTION, outcome: "empty" };

  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch {
    return { state: EMPTY_COLLECTION, outcome: "reset" };
  }

  if (Array.isArray(json)) {
    const favorites = uniqueIds(json, MAX_FAVORITES).map((id) => ({
      id,
      savedAt: now,
    }));
    return {
      state: { version: STORAGE_VERSION, favorites, exhibitions: [] },
      outcome: "migrated",
    };
  }

  const envelope = envelopeSchema.safeParse(json);
  if (
    !envelope.success ||
    envelope.data.version > STORAGE_VERSION ||
    envelope.data.version < 1
  ) {
    return { state: EMPTY_COLLECTION, outcome: "reset" };
  }

  const favorites = readFavorites(envelope.data.favorites ?? []);
  const exhibitions = readExhibitions(envelope.data.exhibitions ?? []);
  return {
    state: {
      version: STORAGE_VERSION,
      favorites: favorites.favorites,
      exhibitions: exhibitions.exhibitions,
    },
    outcome: favorites.changed || exhibitions.changed ? "repaired" : "ok",
  };
}

export function serializeCollection(state: CollectionState): string {
  return JSON.stringify(state);
}

export type UpdateResult<T = void> =
  | { ok: true; state: CollectionState; value: T }
  | { ok: false; reason: "limit" | "invalid" | "not_found" };

export function isFavorite(state: CollectionState, id: number): boolean {
  return state.favorites.some((favorite) => favorite.id === id);
}

export function addFavorite(
  state: CollectionState,
  id: number,
  now = Date.now(),
): UpdateResult {
  if (!artworkId.safeParse(id).success) return { ok: false, reason: "invalid" };
  if (isFavorite(state, id)) return { ok: true, state, value: undefined };
  if (state.favorites.length >= MAX_FAVORITES)
    return { ok: false, reason: "limit" };
  return {
    ok: true,
    state: { ...state, favorites: [{ id, savedAt: now }, ...state.favorites] },
    value: undefined,
  };
}

export function removeFavorite(
  state: CollectionState,
  id: number,
): UpdateResult {
  return {
    ok: true,
    state: { ...state, favorites: state.favorites.filter((f) => f.id !== id) },
    value: undefined,
  };
}

export function removeFavorites(state: CollectionState, ids: readonly number[]): UpdateResult {
  const drop = new Set(ids);
  return { ok: true, state: { ...state, favorites: state.favorites.filter((f) => !drop.has(f.id)) }, value: undefined };
}

// --- Exhibitions --------------------------------------------------------------------------

export function findExhibition(state: CollectionState, id: string): Exhibition | undefined {
  return state.exhibitions.find((exhibition) => exhibition.id === id);
}

/** Creates an exhibition at the top of the list. `id` comes from the caller (crypto.randomUUID). */
export function createExhibition(
  state: CollectionState,
  title: string,
  id: string,
  now = Date.now(),
): UpdateResult<Exhibition> {
  const clean = cleanTitle(title);
  if (!clean || !id || id.length > 64 || findExhibition(state, id)) return { ok: false, reason: "invalid" };
  if (state.exhibitions.length >= MAX_EXHIBITIONS) return { ok: false, reason: "limit" };
  const exhibition: Exhibition = { id, title: clean, artworkIds: [], createdAt: now, updatedAt: now };
  return { ok: true, state: { ...state, exhibitions: [exhibition, ...state.exhibitions] }, value: exhibition };
}

/** Replaces one exhibition, leaving every other one untouched. */
function updateExhibition(
  state: CollectionState,
  id: string,
  change: (exhibition: Exhibition) => UpdateResult<Exhibition>,
): UpdateResult<Exhibition> {
  const current = findExhibition(state, id);
  if (!current) return { ok: false, reason: "not_found" };
  const result = change(current);
  if (!result.ok) return result;
  return {
    ok: true,
    state: { ...state, exhibitions: state.exhibitions.map((e) => (e.id === id ? result.value : e)) },
    value: result.value,
  };
}

export function renameExhibition(state: CollectionState, id: string, title: string, now = Date.now()): UpdateResult<Exhibition> {
  const clean = cleanTitle(title);
  if (!clean) return { ok: false, reason: "invalid" };
  return updateExhibition(state, id, (exhibition) => ({
    ok: true,
    state,
    value: { ...exhibition, title: clean, updatedAt: now },
  }));
}

export function deleteExhibition(state: CollectionState, id: string): UpdateResult {
  if (!findExhibition(state, id)) return { ok: false, reason: "not_found" };
  return { ok: true, state: { ...state, exhibitions: state.exhibitions.filter((e) => e.id !== id) }, value: undefined };
}

/** Adds a work to the end of an exhibition. Adding a work already there is a no-op. */
export function addToExhibition(
  state: CollectionState,
  id: string,
  artworkId: number,
  now = Date.now(),
): UpdateResult<Exhibition> {
  if (!Number.isInteger(artworkId) || artworkId <= 0) return { ok: false, reason: "invalid" };
  return updateExhibition(state, id, (exhibition) => {
    if (exhibition.artworkIds.includes(artworkId)) return { ok: true, state, value: exhibition };
    if (exhibition.artworkIds.length >= MAX_EXHIBITION_ITEMS) return { ok: false, reason: "limit" };
    return {
      ok: true,
      state,
      value: { ...exhibition, artworkIds: [...exhibition.artworkIds, artworkId], updatedAt: now },
    };
  });
}

export function removeFromExhibition(
  state: CollectionState,
  id: string,
  artworkIds: number | readonly number[],
  now = Date.now(),
): UpdateResult<Exhibition> {
  const drop = new Set(typeof artworkIds === "number" ? [artworkIds] : artworkIds);
  return updateExhibition(state, id, (exhibition) => ({
    ok: true,
    state,
    value: { ...exhibition, artworkIds: exhibition.artworkIds.filter((a) => !drop.has(a)), updatedAt: now },
  }));
}
