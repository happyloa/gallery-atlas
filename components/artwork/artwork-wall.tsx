import { ArtworkCard } from "@/components/artwork/artwork-card";
import { FavoriteButton } from "@/components/collections/favorite-button";
import { Reveal } from "@/components/motion/reveal";
import type { Artwork } from "@/lib/artwork/types";
import type { Locale } from "@/lib/i18n/config";
import { cn } from "@/lib/utils";

/**
 * Works hung in rows, each with a save button. Cards rise in and their images are uncovered
 * as they scroll into view, staggered across a row.
 */
export function ArtworkWall({
  artworks,
  locale,
  className,
}: {
  artworks: readonly Artwork[];
  locale: Locale;
  className?: string;
}) {
  return (
    <ul
      className={cn(
        "grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4",
        className,
      )}
    >
      {artworks.map((artwork, index) => (
        <Reveal as="li" key={artwork.id} delay={(index % 4) * 90}>
          <ArtworkCard
            artwork={artwork}
            locale={locale}
            revealDelay={(index % 4) * 90}
            action={
              <FavoriteButton artworkId={artwork.id} title={artwork.title} />
            }
          />
        </Reveal>
      ))}
    </ul>
  );
}
