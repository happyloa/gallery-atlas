import Link from "next/link";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { COLORS, ENTRANCES, ERAS } from "@/lib/artic/config";
import { getCollectionOverview } from "@/lib/artic/overview";
import { searchHref } from "@/lib/artic/search-url";
import { fitClass } from "@/lib/artwork/fit";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

/** Cover cells are square; works keep their own proportions inside. */
const COVER_RATIO = 1;

/**
 * Curated ways into the collection: movements and themes with a cover work, a bar per
 * century, and colour swatches. Every count is live from the museum's API. Left out
 * entirely when the counts can't be read.
 */
export async function WaysIn({
  locale,
  dict,
}: {
  locale: Locale;
  dict: Dictionary;
}) {
  const overview = await getCollectionOverview();
  if (!overview) return null;
  const t = dict.ways;
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const works = (count: number) =>
    format(t.worksCount, { count: number.format(count) });
  const maxEra = Math.max(1, ...ERAS.map((e) => overview.eras[e.slug]));

  return (
    <section aria-labelledby="ways-heading" className="bg-paper-deep">
      <Container className="py-24 sm:py-32">
        <Reveal className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-end lg:gap-16">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
              {t.eyebrow}
            </p>
            <h2
              id="ways-heading"
              className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              {t.heading}
            </h2>
          </div>
          <p className="max-w-lg text-base leading-7 text-ink/80 lg:justify-self-end">
            {t.intro}
          </p>
        </Reveal>

        <ul className="mt-16 grid grid-cols-2 gap-x-5 gap-y-10 sm:gap-x-8 lg:grid-cols-4">
          {ENTRANCES.map((entrance, index) => {
            const { count, cover } = overview.entrances[entrance.slug];
            const label = dict.entrances[entrance.slug];
            return (
              <Reveal as="li" key={entrance.slug} delay={(index % 4) * 90}>
                <Link
                  href={searchHref(locale, { [entrance.kind]: entrance.value })}
                  prefetch={false}
                  className="group block focus-visible:outline-none"
                >
                  <div className="flex aspect-square items-center justify-center bg-paper p-5 transition-colors duration-500 ease-gallery group-hover:bg-[#f8f6f1] group-focus-visible:outline-2 group-focus-visible:outline-offset-4 group-focus-visible:outline-accent sm:p-8">
                    {cover ? (
                      <ArtworkImage
                        image={{ ...cover.image, alt: "" }}
                        sizes="(min-width: 1024px) 20vw, 45vw"
                        reveal={(index % 4) * 90}
                        className={`${fitClass(cover.image.aspectRatio, COVER_RATIO)} shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-500 ease-gallery group-hover:scale-[1.03]`}
                        fallbackClassName="h-full w-full"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="font-serif text-3xl text-ink/30 italic"
                      >
                        {label}
                      </span>
                    )}
                  </div>
                  <div className="mt-4 flex items-start justify-between gap-3 border-t border-ink/15 pt-3">
                    <div>
                      <p className="font-serif text-xl leading-tight">
                        {label}
                      </p>
                      <p className="mt-1 text-sm text-muted">{works(count)}</p>
                    </div>
                    <ArrowRight
                      aria-hidden="true"
                      className="mt-1.5 size-4 shrink-0 -translate-x-1 opacity-0 transition-all duration-300 ease-gallery group-hover:translate-x-0 group-hover:opacity-100"
                    />
                  </div>
                </Link>
              </Reveal>
            );
          })}
        </ul>

        <div className="mt-24 grid gap-16 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-20">
          <Reveal as="section" aria-labelledby="eras-heading">
            <h3
              id="eras-heading"
              className="border-b border-ink/15 pb-3 font-serif text-2xl"
            >
              {t.erasHeading}
            </h3>
            {/* A bar per era, its height by how many works were begun then. */}
            <ol className="mt-6 grid grid-cols-7 items-end gap-1.5 sm:gap-3">
              {ERAS.map((era) => {
                const count = overview.eras[era.slug];
                const height = Math.max(6, Math.sqrt(count / maxEra) * 100);
                return (
                  <li key={era.slug} className="h-full">
                    <Link
                      href={searchHref(locale, { era: era.slug })}
                      prefetch={false}
                      className="group flex h-full flex-col justify-end"
                    >
                      <span className="flex h-36 items-end sm:h-44">
                        <span
                          aria-hidden="true"
                          className="w-full origin-bottom bg-ink/80 transition-colors duration-300 ease-gallery group-hover:bg-accent"
                          style={{ height: `${height}%` }}
                        />
                      </span>
                      <span className="mt-3 block text-[0.6875rem] leading-4 text-ink sm:text-xs">
                        {dict.eras[era.slug]}
                      </span>
                      <span className="mt-0.5 block text-[0.6875rem] text-muted tabular-nums">
                        {number.format(count)}
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ol>
          </Reveal>

          {overview.colors ? (
            <Reveal as="section" aria-labelledby="colors-heading" delay={120}>
              <h3
                id="colors-heading"
                className="border-b border-ink/15 pb-3 font-serif text-2xl"
              >
                {t.colorsHeading}
              </h3>
              <ul className="mt-6 grid grid-cols-4 gap-x-3 gap-y-6 sm:grid-cols-7 lg:grid-cols-4">
                {COLORS.map((color) => (
                  <li key={color.slug}>
                    <Link
                      href={searchHref(locale, { color: color.slug })}
                      prefetch={false}
                      className="group flex flex-col items-center text-center"
                    >
                      <span
                        aria-hidden="true"
                        className="size-12 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)] transition-transform duration-300 ease-gallery group-hover:scale-110 sm:size-14"
                        style={{ backgroundColor: color.swatch }}
                      />
                      <span className="mt-2 text-sm">
                        {dict.colors[color.slug]}
                      </span>
                      <span className="text-[0.6875rem] text-muted tabular-nums">
                        {number.format(overview.colors?.[color.slug] ?? 0)}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mt-6 text-xs text-muted">{t.colorsHint}</p>
            </Reveal>
          ) : null}
        </div>
      </Container>
    </section>
  );
}
