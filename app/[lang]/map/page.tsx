import type { Metadata } from "next";
import Link from "next/link";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { getPlaceCounts } from "@/lib/artic/museum";
import { searchHref } from "@/lib/artic/search-url";
import { MAP_HEIGHT, MAP_WIDTH, project } from "@/lib/geo/projection";
import { PLACES, placeByKey } from "@/lib/geo/places";
import { WORLD_LAND_PATH } from "@/lib/geo/world-land";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.map.heading,
    description: dict.map.metaDescription,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], localizePath(l, "/map")]),
      ),
    },
  };
}

/** "united states" → "United States" for places without a hand-written label. */
function titleCase(key: string): string {
  return key.replace(/(^|[\s-])\p{L}/gu, (match) => match.toUpperCase());
}

export default async function MapPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.map;
  const counts = await getPlaceCounts();
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const labelOf = (key: string) => {
    const place = placeByKey(key);
    return place ? (locale === "en" ? place.en : place.zh) : titleCase(key);
  };

  const dots = counts
    ? PLACES.flatMap((place) => {
        const count = counts.get(place.key) ?? 0;
        return count > 0
          ? [{ place, count, ...project(place.lat, place.lon) }]
          : [];
      }).sort((a, b) => b.count - a.count)
    : [];
  const max = Math.max(1, ...dots.map((d) => d.count));
  const all = counts ? [...counts.entries()].sort((a, b) => b[1] - a[1]) : [];

  return (
    <div className="pb-24 sm:pb-32">
      <section
        aria-labelledby="map-heading"
        className="bg-gallery text-gallery-text"
      >
        <Container className="pt-14 pb-10 sm:pt-20">
          <header className="max-w-3xl animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
            <p className="text-xs font-medium tracking-[0.18em] text-gallery-muted uppercase">
              {t.eyebrow}
            </p>
            <h1
              id="map-heading"
              className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl"
            >
              {t.heading}
            </h1>
          </header>
        </Container>
        <div className="mx-auto max-w-[1440px] animate-fade-in px-2 pb-12 [animation-delay:calc(var(--intro-delay)+300ms)] sm:px-8 lg:px-12">
          {/* Pointer users can click the circles; everyone gets the same links in the list below. */}
          <svg
            viewBox={`0 0 ${MAP_WIDTH} ${MAP_HEIGHT}`}
            aria-hidden="true"
            className="h-auto w-full"
          >
            <path
              d={WORLD_LAND_PATH}
              fill="#2f2c28"
              stroke="#3b3833"
              strokeWidth={0.6}
            />
            {dots.map(({ place, count, x, y }) => {
              const r = 2.5 + Math.sqrt(count / max) * 26;
              return (
                <a
                  key={place.key}
                  href={searchHref(locale, { place: place.key })}
                  tabIndex={-1}
                  className="group"
                >
                  <title>{`${labelOf(place.key)} · ${number.format(count)}`}</title>
                  <circle
                    cx={x}
                    cy={y}
                    r={r}
                    className="fill-[#d6a77a]/45 stroke-[#f1d9bd]/70 transition-[fill] duration-200 group-hover:fill-[#e9b98a]/85"
                    strokeWidth={0.8}
                  />
                </a>
              );
            })}
          </svg>
        </div>
      </section>

      <Container className="mt-16 sm:mt-20">
        <Reveal as="section" aria-labelledby="places-heading">
          <h2
            id="places-heading"
            className="border-b border-line pb-4 font-serif text-3xl sm:text-4xl"
          >
            {t.listHeading}
          </h2>
          {counts ? (
            <ol className="mt-8 columns-2 gap-x-10 sm:columns-3 lg:columns-4">
              {all.map(([key, count]) => (
                <li key={key} className="break-inside-avoid">
                  <Link
                    href={searchHref(locale, { place: key })}
                    prefetch={false}
                    className="group flex items-baseline justify-between gap-3 border-b border-line py-2.5 text-sm"
                  >
                    <span className="group-hover:underline group-hover:underline-offset-4">
                      {labelOf(key)}
                    </span>
                    <span className="text-muted tabular-nums">
                      {number.format(count)}
                    </span>
                  </Link>
                </li>
              ))}
            </ol>
          ) : (
            <p className="mt-8 text-muted">{t.unavailable}</p>
          )}
        </Reveal>
      </Container>
    </div>
  );
}
