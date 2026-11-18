import Link from "next/link";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { Reveal } from "@/components/motion/reveal";
import { buttonStyles } from "@/components/ui/button";
import { ArrowRight } from "@/components/ui/icons";
import { getArtwork } from "@/lib/artic/artworks";
import { getWorkOfTheDayId } from "@/lib/artic/museum";
import { fitClass } from "@/lib/artwork/fit";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";

/**
 * One of the museum's highlighted works, the same for everyone all day (UTC), with a way
 * to jump to a random one. Left out when the API can't name one.
 */
export async function DailyWork({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const id = await getWorkOfTheDayId(new Date());
  const lookup = id ? await getArtwork(id).catch(() => null) : null;
  if (lookup?.status !== "ok") return null;
  const { artwork } = lookup;
  const t = dict.daily;
  const href = localizePath(locale, `/artworks/${artwork.id}`);

  return (
    <Reveal className="grid items-center gap-10 border-b border-ink/15 pb-16 sm:pb-20 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] lg:gap-16">
      <Link
        href={href}
        tabIndex={-1}
        aria-hidden="true"
        className="group flex aspect-[5/4] items-center justify-center bg-paper p-8 sm:p-12"
      >
        <ArtworkImage
          image={{ ...artwork.image, alt: "" }}
          sizes="(min-width: 1024px) 50vw, 90vw"
          reveal={0}
          className={`${fitClass(artwork.image.aspectRatio, 5 / 4)} shadow-[0_24px_40px_-22px_rgb(34_33_31/0.6)] transition-transform duration-700 ease-gallery group-hover:scale-[1.02]`}
          fallbackClassName="h-full w-full"
        />
      </Link>
      <div>
        <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
          {t.eyebrow}
        </p>
        <h2 lang="en" className="mt-4 font-serif text-4xl leading-tight italic sm:text-5xl">
          {artwork.title}
        </h2>
        <p lang="en" className="mt-4 text-lg">
          {artwork.artist}
        </p>
        {artwork.dateDisplay ? (
          <p lang="en" className="mt-1 text-muted">
            {artwork.dateDisplay}
          </p>
        ) : null}
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link href={href} className={buttonStyles()}>
            {t.view}
            <ArrowRight aria-hidden="true" className="size-4" />
          </Link>
          <a
            href={`/${locale}/random`}
            className="text-sm underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
          >
            {t.random}
          </a>
        </div>
      </div>
    </Reveal>
  );
}
