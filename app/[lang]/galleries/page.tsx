import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { describeFailure } from "@/lib/artic/error-reason";
import { galleriesByFloor, getGalleryOverview } from "@/lib/artic/museum";
import type { GalleryListing } from "@/lib/artic/museum";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatCount } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

type Params = Promise<{ lang: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.galleries.heading,
    description: dict.galleries.metaDescription,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], localizePath(l, "/galleries")]),
      ),
    },
  };
}

export default async function GalleriesPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.galleries;
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  let galleries: GalleryListing[] | null = null;
  let failure: ReturnType<typeof describeFailure> | null = null;
  try {
    galleries = await getGalleryOverview();
  } catch (caught) {
    failure = describeFailure(caught);
  }
  const floors = galleries ? galleriesByFloor(galleries) : [];

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            {t.heading}
          </h1>
        </header>
      </Container>

      <Container className="mt-14 sm:mt-20">
        {failure ? <ResultsError {...failure} /> : null}
        <div className="space-y-16 sm:space-y-20">
          {floors.map(({ floor, galleries: rooms }) => {
            const label = floor
              ? t.floors[floor as keyof typeof t.floors]
              : t.floors.other;
            const headingId = `floor-${floor ?? "other"}`;
            return (
              <Reveal
                as="section"
                key={floor ?? "other"}
                aria-labelledby={headingId}
                className="grid gap-6 md:grid-cols-[minmax(0,12rem)_minmax(0,1fr)] md:gap-12"
              >
                <h2
                  id={headingId}
                  className="font-serif text-3xl md:sticky md:top-24 md:self-start"
                >
                  {label}
                </h2>
                <ul className="grid grid-cols-1 gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
                  {rooms.map((gallery) => (
                    <li key={gallery.id}>
                      <Link
                        href={localizePath(locale, `/galleries/${gallery.id}`)}
                        prefetch={false}
                        className={cn(
                          "group flex items-baseline justify-between gap-4 border-b border-line py-3 text-sm",
                          gallery.works === 0 && "text-muted",
                        )}
                      >
                        <span
                          lang="en"
                          className="group-hover:underline group-hover:underline-offset-4"
                        >
                          {gallery.name}
                          {gallery.isClosed ? (
                            <span className="ml-2 text-xs text-muted">
                              {dict.gallery.closed}
                            </span>
                          ) : null}
                        </span>
                        {gallery.works > 0 ? (
                          <span className="shrink-0 text-muted tabular-nums">
                            {formatCount(
                              dict.ways.worksCountOne,
                              dict.ways.worksCount,
                              gallery.works,
                              number.format(gallery.works),
                            )}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  ))}
                </ul>
              </Reveal>
            );
          })}
        </div>
      </Container>
    </div>
  );
}
