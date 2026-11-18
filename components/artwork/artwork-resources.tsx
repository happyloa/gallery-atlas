import Link from "next/link";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { OutLink } from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { ArrowRight } from "@/components/ui/icons";
import { getArtworkResources } from "@/lib/artic/media";
import type { ArtworkDetail } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

const headingClass =
  "text-xs font-medium tracking-[0.18em] text-accent uppercase md:pt-2";

/** Other photographs, catalogue entries, documents, video and microsites for one work. */
export async function ArtworkResources({
  artwork,
  locale,
  dict,
}: {
  artwork: ArtworkDetail;
  locale: Locale;
  dict: Dictionary;
}) {
  const t = dict.workExtras;
  const { views, catalogue, documents, videos, sites } =
    await getArtworkResources(artwork);
  const hasLinks =
    catalogue.length + documents.length + sites.length + videos.length > 0;
  if (views.length === 0 && !hasLinks) return null;

  return (
    <div className="space-y-16 sm:space-y-24">
      {views.length > 0 ? (
        <Reveal
          as="section"
          aria-labelledby="more-views"
          className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
        >
          <h2 id="more-views" className={headingClass}>
            {t.moreViews}
          </h2>
          <ul className="grid grid-cols-2 gap-4 lg:grid-cols-3">
            {views.map((image, index) => (
              <li
                key={image.src}
                className="flex aspect-square items-center justify-center bg-paper-deep p-4"
              >
                <ArtworkImage
                  image={{
                    ...image,
                    alt: format(t.viewAlt, {
                      number: index + 1,
                      title: artwork.title,
                    }),
                  }}
                  sizes="(min-width: 1024px) 24vw, 45vw"
                  className="max-h-full w-auto max-w-full object-contain"
                  fallbackClassName="h-full w-full"
                />
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      {videos.length > 0 ? (
        <Reveal
          as="section"
          aria-labelledby="work-video"
          className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
        >
          <h2 id="work-video" className={headingClass}>
            {t.video}
          </h2>
          <div className="max-w-3xl space-y-6">
            {videos.map((video) => (
              // The museum publishes no captions for this video.
              // eslint-disable-next-line jsx-a11y/media-has-caption
              <video
                key={video.id}
                controls
                preload="none"
                src={video.url}
                aria-label={video.title}
                className="aspect-video w-full bg-paper-deep"
              />
            ))}
          </div>
        </Reveal>
      ) : null}

      {catalogue.length > 0 ? (
        <Reveal
          as="section"
          aria-labelledby="catalogue-entries"
          className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
        >
          <h2 id="catalogue-entries" className={headingClass}>
            {t.catalogue}
          </h2>
          <ul className="max-w-3xl divide-y divide-line border-y border-line">
            {catalogue.map((entry) => (
              <li key={entry.id}>
                <Link
                  href={localizePath(
                    locale,
                    `/read/catalogue-entries/${entry.id}`,
                  )}
                  prefetch={false}
                  className="group flex items-baseline justify-between gap-6 py-4"
                >
                  <span lang="en">
                    <span className="block font-serif text-xl leading-snug group-hover:underline group-hover:underline-offset-4">
                      {entry.title}
                    </span>
                    {entry.publication ? (
                      <span className="mt-1 block text-sm text-muted">
                        {entry.publication}
                      </span>
                    ) : null}
                  </span>
                  <ArrowRight aria-hidden="true" className="size-4 shrink-0" />
                </Link>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}

      {documents.length + sites.length > 0 ? (
        <Reveal
          as="section"
          aria-labelledby="work-documents"
          className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
        >
          <h2 id="work-documents" className={headingClass}>
            {documents.length > 0 ? t.documents : t.sites}
          </h2>
          <ul lang="en" className="max-w-3xl space-y-3">
            {[...documents, ...sites].map((item) => (
              <li key={item.id}>
                <OutLink href={item.url} dict={dict}>
                  {item.title}
                </OutLink>
              </li>
            ))}
          </ul>
        </Reveal>
      ) : null}
    </div>
  );
}
