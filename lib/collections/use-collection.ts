"use client";

import { useCallback, useSyncExternalStore } from "react";
import { addFavorite, isFavorite, removeFavorite } from "./schema";
import type { CollectionState } from "./schema";
import { getServerSnapshot, getSnapshot, subscribe, update } from "./store";
import type { WriteResult } from "./store";

/** The saved collection. Empty during server render and hydration, then the stored state. */
export function useCollection(): CollectionState {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
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
