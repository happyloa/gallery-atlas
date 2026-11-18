import type { Metadata } from "next";
import { ExploreSection } from "@/components/discover/explore-section";
import { HeroGallery } from "@/components/discover/hero-gallery";
import { ARTWORK_TYPES } from "@/lib/artic/config";
import { getFeaturedArtworks } from "@/lib/artic/featured";
import { parseSearchQuery } from "@/lib/artic/queries";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const DESCRIPTION =
  "Walk a room of public-domain paintings from the Art Institute of Chicago, then search and browse the collection.";

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParams;
}): Promise<Metadata> {
  const { query } = parseSearchQuery(await searchParams);
  const type = ARTWORK_TYPES.find((t) => t.slug === query.type)?.label;
  const parts = [query.q && `“${query.q}”`, type].filter(Boolean);
  if (parts.length === 0)
    return {
      title: { absolute: "Gallery Atlas · Public-domain art" },
      description: DESCRIPTION,
    };
  // Search result pages are useful to visitors but thin for search engines.
  return {
    title: `${parts.join(" · ")} in the collection`,
    description: DESCRIPTION,
    robots: { index: false },
  };
}

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default async function Home({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const parsed = parseSearchQuery(await searchParams);
  const featured = await getFeaturedArtworks();
  const live = featured.source === "live";

  return (
    <>
      <HeroGallery
        artworks={featured.artworks}
        eyebrow={live ? "Room I · Highlights" : "Room I · Saved snapshot"}
        note={
          live || !featured.snapshotDate
            ? undefined
            : `The museum’s collection couldn’t be reached, so this room shows works saved on ${formatDate(featured.snapshotDate)}.`
        }
      />
      <ExploreSection
        query={parsed.query}
        error={parsed.ok ? undefined : parsed.error}
      />
    </>
  );
}
