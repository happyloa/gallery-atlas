import type { Metadata } from "next";
import Link from "next/link";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { Pagination } from "@/components/discover/pagination";
import { ResultsError } from "@/components/discover/results-error";
import { Reveal } from "@/components/motion/reveal";
import {
  exhibitionDates,
  ExhibitionStatus,
} from "@/components/museum/exhibition-meta";
import { Container } from "@/components/ui/container";
import { getArtworksByIds } from "@/lib/artic/artworks";
import { describeFailure } from "@/lib/artic/error-reason";
import { getMuseumExhibitions } from "@/lib/artic/museum";
import { EMPTY_QUERY, parseSearchQuery } from "@/lib/artic/queries";
import { fitClass } from "@/lib/artwork/fit";
import type { Artwork } from "@/lib/artwork/types";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatCount } from "@/lib/i18n/format";

type Params = Promise<{ lang: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

/** First ids per exhibition tried as its cover; most lists open with a displayable work. */
const COVER_CANDIDATES = 3;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.museumExhibitions.heading,
    description: dict.museumExhibitions.metaDescription,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], localizePath(l, "/exhibitions")]),
      ),
    },
  };
}

export default async function ExhibitionsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.museumExhibitions;
  const parsed = parseSearchQuery(await searchParams);
  const page = parsed.ok ? parsed.query.page : 1;

  let result: Awaited<ReturnType<typeof getMuseumExhibitions>> | null = null;
  let failure: ReturnType<typeof describeFailure> | null = null;
  try {
    result = await getMuseumExhibitions(page);
  } catch (caught) {
    failure = describeFailure(caught);
  }

  // One batch read for the covers of the whole page.
  const covers = new Map<number, Artwork>();
  if (result) {
    const candidates = result.exhibitions.flatMap((e) =>
      e.artworkIds.slice(0, COVER_CANDIDATES),
    );
    const read = await getArtworksByIds(candidates, {
      timeoutMs: 6000,
      retries: 1,
    }).catch(() => null);
    const byId = new Map(read?.artworks.map((a) => [a.id, a]) ?? []);
    for (const exhibition of result.exhibitions) {
      const cover = exhibition.artworkIds
        .slice(0, COVER_CANDIDATES)
        .map((id) => byId.get(id))
        .find(Boolean);
      if (cover) covers.set(exhibition.id, cover);
    }
  }
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <header className="max-w-3xl animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            {t.heading}
          </h1>
        </header>
      </Container>

      <Container className="mt-16">
        {failure ? <ResultsError {...failure} /> : null}
        {result ? (
          <>
            <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
              {result.exhibitions.map((exhibition, index) => {
                const cover = covers.get(exhibition.id);
                const dates = exhibitionDates(exhibition, locale, dict);
                return (
                  <Reveal as="li" key={exhibition.id} delay={(index % 3) * 90}>
                    <article className="group relative">
                      <div className="flex aspect-[4/3] items-center justify-center bg-paper-deep p-6">
                        {cover ? (
                          <ArtworkImage
                            image={{ ...cover.image, alt: "" }}
                            sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                            reveal={(index % 3) * 90}
                            className={`${fitClass(cover.image.aspectRatio, 4 / 3)} shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-500 ease-gallery group-hover:scale-[1.02]`}
                            fallbackClassName="h-full w-full"
                          />
                        ) : (
                          // No public-domain work to show: the title stands in, like a poster.
                          <span
                            aria-hidden="true"
                            lang="en"
                            className="line-clamp-4 px-2 text-center font-serif text-3xl leading-tight text-ink/35 italic transition-colors duration-500 group-hover:text-ink/55"
                          >
                            {exhibition.title}
                          </span>
                        )}
                      </div>
                      <ExhibitionStatus
                        exhibition={exhibition}
                        dict={dict}
                        className="mt-4"
                      />
                      <h2
                        lang="en"
                        className="mt-2 font-serif text-2xl leading-snug"
                      >
                        <Link
                          href={localizePath(
                            locale,
                            `/exhibitions/${exhibition.id}`,
                          )}
                          className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
                        >
                          {exhibition.title}
                        </Link>
                      </h2>
                      {dates ? (
                        <p className="mt-1 text-sm text-muted">{dates}</p>
                      ) : null}
                      <p className="mt-1 text-sm text-muted">
                        {formatCount(
                          t.worksCountOne,
                          t.worksCount,
                          exhibition.artworkIds.length,
                          number.format(exhibition.artworkIds.length),
                        )}
                      </p>
                    </article>
                  </Reveal>
                );
              })}
            </ul>
            <Pagination
              locale={locale}
              dict={dict}
              query={{ ...EMPTY_QUERY, page }}
              totalPages={result.totalPages}
              hrefFor={(next) =>
                `${localizePath(locale, "/exhibitions")}${next > 1 ? `?page=${next}` : ""}`
              }
            />
          </>
        ) : null}
      </Container>
    </div>
  );
}
