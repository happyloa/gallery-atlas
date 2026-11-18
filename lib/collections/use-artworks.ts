"use client";

import { useEffect, useMemo, useState } from "react";
import type { Artwork } from "@/lib/artwork/types";

/** The batch route accepts up to 200 ids per request. */
const CHUNK = 200;

/**
 * Records already fetched in this page session, shared by every component, so moving
 * between My Collection and an exhibition does not fetch the same works twice. Records come
 * from /api/artworks, which re-checks every id on the server.
 */
const records = new Map<number, Artwork>();
const unavailable = new Set<number>();

async function fetchChunk(ids: number[], signal: AbortSignal): Promise<void> {
  const response = await fetch(`/api/artworks?ids=${ids.join(",")}`, {
    signal,
  });
  if (!response.ok)
    throw new Error(`Batch request failed (${response.status})`);
  const body = (await response.json()) as {
    artworks: Artwork[];
    unavailable: number[];
  };
  for (const artwork of body.artworks) records.set(artwork.id, artwork);
  for (const id of body.unavailable) unavailable.add(id);
}

export interface ArtworkRecords {
  /** Records for `ids` that are loaded and displayable, in the given order. */
  artworks: Artwork[];
  /** Ids the server says can no longer be shown. */
  unavailable: number[];
  /** Ids still being fetched. */
  pending: number;
  failed: boolean;
  retry: () => void;
}

export function useArtworks(ids: readonly number[]): ArtworkRecords {
  // Bumped whenever the shared cache gains records, to re-read it.
  const [version, setVersion] = useState(0);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const missing = useMemo(
    () => ids.filter((id) => !records.has(id) && !unavailable.has(id)),
    // version: the cache changed; recompute what is still missing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, version],
  );
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!missingKey) return;
    const controller = new AbortController();
    const wanted = missingKey.split(",").map(Number);
    (async () => {
      for (let start = 0; start < wanted.length; start += CHUNK) {
        await fetchChunk(wanted.slice(start, start + CHUNK), controller.signal);
      }
    })()
      .then(() => {
        setFailed(false);
        setVersion((v) => v + 1);
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        console.error(error);
        setFailed(true);
      });
    return () => controller.abort();
  }, [missingKey, attempt]);

  return useMemo(
    () => ({
      artworks: ids.flatMap((id) => {
        const artwork = records.get(id);
        return artwork ? [artwork] : [];
      }),
      unavailable: ids.filter((id) => unavailable.has(id)),
      pending: failed ? 0 : missing.length,
      failed,
      retry: () => {
        setFailed(false);
        setAttempt((n) => n + 1);
      },
    }),
    // version: re-read the shared cache after it changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [ids, missing, failed, version],
  );
}
