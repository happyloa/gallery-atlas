"use client";

import { useCallback, useSyncExternalStore } from "react";
import {
  addFavorite,
  addToExhibition,
  createExhibition,
  deleteExhibition,
  importExhibition,
  isFavorite,
  removeFavorite,
  removeFromExhibition,
  renameExhibition,
} from "./schema";
import type { CollectionState, Exhibition } from "./schema";
import { getServerSnapshot, getSnapshot, subscribe, update } from "./store";
import type { WriteResult } from "./store";

/** The saved collection. Empty during server render and hydration, then the stored state. */
export function useCollection(): CollectionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

const noop = () => () => {};
/** False during server render and hydration, true afterwards. */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

export function useFavorite(id: number): {
  saved: boolean;
  toggle: () => WriteResult<"saved" | "removed">;
} {
  const collection = useCollection();
  const saved = isFavorite(collection, id);
  const toggle = useCallback((): WriteResult<"saved" | "removed"> => {
    return update((state) => {
      if (isFavorite(state, id)) {
        const result = removeFavorite(state, id);
        return result.ok ? { ...result, value: "removed" as const } : result;
      }
      const result = addFavorite(state, id);
      return result.ok ? { ...result, value: "saved" as const } : result;
    });
  }, [id]);
  return { saved, toggle };
}

function newId(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `ex-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** Writes for exhibitions. Each applies to the latest stored state, so other tabs' edits are kept. */
export const exhibitionActions = {
  create: (title: string): WriteResult<Exhibition> =>
    update((state) => createExhibition(state, title, newId())),
  rename: (id: string, title: string): WriteResult<Exhibition> =>
    update((state) => renameExhibition(state, id, title)),
  remove: (id: string): WriteResult =>
    update((state) => deleteExhibition(state, id)),
  addWork: (id: string, artworkId: number): WriteResult<Exhibition> =>
    update((state) => addToExhibition(state, id, artworkId)),
  removeWorks: (
    id: string,
    artworkIds: number | readonly number[],
  ): WriteResult<Exhibition> =>
    update((state) => removeFromExhibition(state, id, artworkIds)),
  importShared: (
    title: string,
    artworkIds: readonly number[],
  ): WriteResult<Exhibition> =>
    update((state) => importExhibition(state, title, artworkIds, newId())),
};
