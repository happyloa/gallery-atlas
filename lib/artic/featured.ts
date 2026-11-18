/**
 * The works hung in the homepage's 3D room. Fetched live by id; if the API is down the
 * room falls back to the dated snapshot in lib/fixtures, and the page says so.
 */
import type { Artwork } from "@/lib/artwork/types";
import {
  PREVIEW_FIXTURE_DATE,
  previewArtworks,
} from "@/lib/fixtures/preview-artworks";
import { getArtworksByIds } from "./artworks";

/** Seurat, Caillebotte, van Gogh, Monet ×2, Renoir, Cézanne, van Gogh (self-portrait). */
export const FEATURED_ARTWORK_IDS = [
  27992, 20684, 28560, 16568, 64818, 14655, 111436, 80607,
] as const;

export interface FeaturedArtworks {
  artworks: Artwork[];
  /** "live": from the API just now (or its cache). "snapshot": the offline fallback. */
  source: "live" | "snapshot";
  /** ISO date of the snapshot, when source is "snapshot". */
  snapshotDate?: string;
}

export async function getFeaturedArtworks(): Promise<FeaturedArtworks> {
  try {
    // A short timeout and one retry: the room has a fallback, so don't hold the page.
    const { artworks } = await getArtworksByIds(FEATURED_ARTWORK_IDS, {
      timeoutMs: 5000,
      retries: 1,
    });
    if (artworks.length >= 3) return { artworks, source: "live" };
  } catch {
    // Fall through to the snapshot.
  }
  const snapshot = previewArtworks.filter((artwork) =>
    (FEATURED_ARTWORK_IDS as readonly number[]).includes(artwork.id),
  );
  return {
    artworks: snapshot,
    source: "snapshot",
    snapshotDate: PREVIEW_FIXTURE_DATE,
  };
}
