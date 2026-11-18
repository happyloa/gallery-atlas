/**
 * The homepage's ways into the collection: curated entrances with a cover work, and how
 * many works each era and colour holds. Counts come from two aggregation requests that
 * return no records; covers come from one batch read. All of it is cached for a day.
 */
import type { Artwork } from "@/lib/artwork/types";
import { reportUpstreamFailure } from "@/lib/render-health";
import { getArtworksByIds } from "./artworks";
import { aicGet } from "./client";
import { COLORS, ENTRANCES, ERAS, REVALIDATE_REFERENCE } from "./config";
import type { ColorSlug, EntranceSlug, EraSlug } from "./config";
import { colorCountsFromHues } from "./filters";
import { huesPath, overviewPath } from "./queries";
import { huesResponseSchema, overviewResponseSchema } from "./schema";

export interface CollectionOverview {
  /** Displayable works in the whole collection. */
  total: number;
  entrances: Record<EntranceSlug, { count: number; cover: Artwork | null }>;
  eras: Record<EraSlug, number>;
  /** Null when the colour counts could not be read; the rest still shows. */
  colors: Record<ColorSlug, number> | null;
}

const REQUEST = {
  timeoutMs: 6000,
  retries: 1,
  revalidate: REVALIDATE_REFERENCE,
};

/** Null when the counts are unavailable; the homepage then leaves the section out. */
export async function getCollectionOverview(): Promise<CollectionOverview | null> {
  const [counts, hues, covers] = await Promise.allSettled([
    aicGet(overviewPath(), REQUEST),
    aicGet(huesPath(), REQUEST),
    // The covers are a fixed list too.
    getArtworksByIds(
      ENTRANCES.map((e) => e.cover),
      REQUEST,
    ),
  ]);

  if (counts.status !== "fulfilled") return null;
  const parsed = overviewResponseSchema.safeParse(counts.value);
  if (!parsed.success) {
    // Counts arrived but could not be read: the section is left out, and the page not kept.
    reportUpstreamFailure();
    return null;
  }
  const { entrances, eras } = parsed.data.aggregations;

  const coverById = new Map(
    covers.status === "fulfilled"
      ? covers.value.artworks.map((artwork) => [artwork.id, artwork])
      : [],
  );
  const eraCounts = new Map(eras.buckets.map((b) => [b.key, b.doc_count]));

  let colors: CollectionOverview["colors"] = null;
  if (hues.status === "fulfilled") {
    const huesParsed = huesResponseSchema.safeParse(hues.value);
    if (huesParsed.success)
      colors = colorCountsFromHues(huesParsed.data.aggregations.hues.buckets);
    else reportUpstreamFailure();
  }

  return {
    total: parsed.data.pagination.total,
    entrances: Object.fromEntries(
      ENTRANCES.map((e) => [
        e.slug,
        {
          count: entrances.buckets[e.slug]?.doc_count ?? 0,
          cover: coverById.get(e.cover) ?? null,
        },
      ]),
    ) as CollectionOverview["entrances"],
    eras: Object.fromEntries(
      ERAS.map((e) => [e.slug, eraCounts.get(e.slug) ?? 0]),
    ) as Record<EraSlug, number>,
    colors: colors
      ? (Object.fromEntries(
          COLORS.map((c) => [c.slug, colors[c.slug]]),
        ) as Record<ColorSlug, number>)
      : null,
  };
}
