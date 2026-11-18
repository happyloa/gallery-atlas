import Link from "next/link";
import type { ReactNode } from "react";
import type { Artwork } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { fitClass } from "@/lib/artwork/fit";
import { ArtworkImage } from "./artwork-image";

/** Each card is a 4:5 wall cell. */
const CELL_RATIO = 4 / 5;

const CARD_SIZES =
  "(min-width: 1280px) 22vw, (min-width: 1024px) 30vw, (min-width: 420px) 45vw, 90vw";

/**
 * Works are "hung on a line": every image keeps its own proportions and sits on a shared
 * baseline inside a fixed-height wall cell, so rows stay aligned without cropping.
 *
 * The title link stretches over the whole card (::after), so the card is one click target.
 * `action` (e.g. a save button) sits above that layer as a sibling, never inside the link.
 */
export function ArtworkCard({
  artwork,
  locale,
  action,
  revealDelay,
}: {
  artwork: Artwork;
  locale: Locale;
  action?: ReactNode;
  /** Uncover the image when it scrolls into view, after this many milliseconds. */
  revealDelay?: number;
}) {
  // The museum's records are English; say so on a page in another language.
  const dataLang = locale === "en" ? undefined : "en";
  return (
    <article className="group relative">
      <div className="flex aspect-[4/5] items-end justify-center">
        <ArtworkImage
          image={artwork.image}
          sizes={CARD_SIZES}
          reveal={revealDelay ?? false}
          className={`${fitClass(artwork.image.aspectRatio, CELL_RATIO)} shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-300 ease-gallery group-hover:-translate-y-1`}
          fallbackClassName="max-h-full w-full"
        />
      </div>
      <div className="mt-5 border-t border-line pt-4">
        <h3
          lang={dataLang}
          className="font-serif text-lg leading-snug text-ink italic"
        >
          <Link
            href={localizePath(locale, `/artworks/${artwork.id}`)}
            className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
          >
            {artwork.title}
          </Link>
        </h3>
        <p lang={dataLang} className="mt-1 text-sm text-ink">
          {artwork.artist}
        </p>
        {artwork.dateDisplay ? (
          <p lang={dataLang} className="mt-0.5 text-sm text-muted">
            {artwork.dateDisplay}
          </p>
        ) : null}
      </div>
      {action ? (
        <div className="absolute top-2 right-2 z-10">{action}</div>
      ) : null}
    </article>
  );
}
