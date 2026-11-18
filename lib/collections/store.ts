/**
 * The browser side of saved works: reads and writes localStorage and notifies subscribers,
 * in this tab (a custom event) and in other tabs (the `storage` event).
 *
 * Designed for useSyncExternalStore. On the server, and during hydration, the snapshot is
 * the empty collection, so server HTML and the first client render always agree; the saved
 * state appears right after hydration.
 */
import {
  EMPTY_COLLECTION,
  parseCollection,
  serializeCollection,
  STORAGE_KEY,
} from "./schema";
import type { CollectionState, UpdateResult } from "./schema";

const CHANGE_EVENT = "gallery-atlas:collection-change";

let cachedRaw: string | null | undefined;
let cachedState: CollectionState = EMPTY_COLLECTION;

function readRaw(): string | null {
  try {
    return window.localStorage.getItem(STORAGE_KEY);
  } catch {
    // Storage blocked (privacy settings, sandboxed frame): behave as an empty collection.
    return null;
  }
}

/** Current state. Returns the same object until the stored string changes. */
export function getSnapshot(): CollectionState {
  if (typeof window === "undefined") return EMPTY_COLLECTION;
  const raw = readRaw();
  if (raw !== cachedRaw) {
    cachedRaw = raw;
    const { state, outcome } = parseCollection(raw);
    cachedState = state;
    // Write back a cleaned-up copy so the repair happens once, not on every read.
    if (outcome === "migrated" || outcome === "repaired" || outcome === "reset")
      persist(state);
  }
  return cachedState;
}

export function getServerSnapshot(): CollectionState {
  return EMPTY_COLLECTION;
}

export function subscribe(onChange: () => void): () => void {
  const onStorage = (event: StorageEvent) => {
    if (event.key === STORAGE_KEY || event.key === null) onChange();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, onChange);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, onChange);
  };
}

function persist(state: CollectionState): boolean {
  const raw = serializeCollection(state);
  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    return false;
  }
  cachedRaw = raw;
  cachedState = state;
  return true;
}

export type WriteResult<T = void> =
  | { ok: true; value: T }
  | { ok: false; reason: "limit" | "invalid" | "not_found" | "storage" };

/** Applies an update to the latest stored state and saves it. */
export function update<T>(
  apply: (state: CollectionState) => UpdateResult<T>,
): WriteResult<T> {
  const result = apply(getSnapshot());
  if (!result.ok) return result;
  if (!persist(result.state)) return { ok: false, reason: "storage" };
  window.dispatchEvent(new Event(CHANGE_EVENT));
  return { ok: true, value: result.value };
}

/** Test hook: forget the cached read. */
export function resetStoreCache(): void {
  cachedRaw = undefined;
  cachedState = EMPTY_COLLECTION;
}
