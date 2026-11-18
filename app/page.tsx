import { ExploreSection } from "@/components/discover/explore-section";
import { HeroGallery } from "@/components/discover/hero-gallery";
import {
  PREVIEW_FIXTURE_DATE,
  previewArtworks,
} from "@/lib/fixtures/preview-artworks";

const HERO_SIZE = 8;

function formatDate(isoDate: string): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}

export default function Home() {
  const snapshotDate = formatDate(PREVIEW_FIXTURE_DATE);

  return (
    <>
      <HeroGallery
        artworks={previewArtworks.slice(0, HERO_SIZE)}
        note={`Preview hang: a snapshot of public-domain works from the museum's API, taken ${snapshotDate}.`}
      />
      <ExploreSection
        artworks={previewArtworks}
        previewNotice={`Preview snapshot from ${snapshotDate}. Live search and filters are coming next.`}
      />
    </>
  );
}
