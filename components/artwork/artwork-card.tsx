import type { Artwork } from "@/lib/artwork/types";
import { ArtworkImage } from "./artwork-image";

const CARD_SIZES =
  "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 420px) 45vw, 90vw";

/**
 * Works are "hung on a line": every image keeps its own proportions and sits on a shared
 * baseline inside a fixed-height wall cell, so rows stay aligned without cropping.
 */
export function ArtworkCard({ artwork }: { artwork: Artwork }) {
  return (
    <article className="group">
      <div className="flex aspect-[4/5] items-end justify-center">
        <ArtworkImage
          image={artwork.image}
          sizes={CARD_SIZES}
          className="h-auto max-h-full w-auto max-w-full shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-300 ease-gallery group-hover:-translate-y-1"
          fallbackClassName="max-h-full w-full"
        />
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <h3 className="font-serif text-lg leading-snug text-ink italic">
          {artwork.title}
        </h3>
        <p className="mt-1 text-sm text-ink">{artwork.artist}</p>
        {artwork.dateDisplay ? (
          <p className="mt-0.5 text-sm text-muted">{artwork.dateDisplay}</p>
        ) : null}
      </div>
    </article>
  );
}
