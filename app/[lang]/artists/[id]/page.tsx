import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { ResultsError } from "@/components/discover/results-error";
import type { ResultsErrorReason } from "@/components/discover/results-error";
import { Pagination } from "@/components/discover/pagination";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ArrowLeft, ArrowUpRight } from "@/components/ui/icons";
import { getArtist, searchArtworks } from "@/lib/artic/artworks";
import { isAicError } from "@/lib/artic/client";
import { EMPTY_QUERY, parseId, parseSearchQuery } from "@/lib/artic/queries";
import type { Artist } from "@/lib/artwork/types";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { EXTERNAL_REL } from "@/lib/utils";

type Params = Promise<{ lang: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

/** One upstream read shared by generateMetadata and the page. */
const loadArtist = cache(async (rawId: string) => {
  const id = parseId(rawId);
  if (id === null) return { status: "not_found" as const };
  return getArtist(id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const lookup = await loadArtist(id).catch(() => null);
  if (lookup?.status !== "ok") return { title: dict.meta.notFoundTitle };
  const { artist } = lookup;
  return {
    title: artist.name,
    description: format(dict.artist.metaDescription, { name: artist.name }),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          LOCALE_TAGS[l],
          localizePath(l, `/artists/${artist.id}`),
        ]),
      ),
    },
  };
}

function lifespan(artist: Artist, dict: Dictionary): string | null {
  const { birthYear: birth, deathYear: death } = artist;
  if (birth !== null && death !== null)
    return format(dict.artist.lifespan, { birth, death });
  if (birth !== null) return format(dict.artist.born, { birth });
  if (death !== null) return format(dict.artist.died, { death });
  return null;
}

export default async function ArtistPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { lang, id: rawId } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.artist;
  const lookup = await loadArtist(rawId);
  if (lookup.status !== "ok") notFound();
  const { artist } = lookup;
  const parsed = parseSearchQuery(await searchParams);
  const page = parsed.ok ? parsed.query.page : 1;
  const years = lifespan(artist, dict);

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <Link
          href={`${localizePath(locale, "/")}#explore`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {dict.detail.back}
        </Link>
      </Container>

      <Container className="mt-10 grid gap-12 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)] lg:gap-20">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1
            lang="en"
            className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight text-balance sm:text-6xl lg:text-7xl"
          >
            {artist.name}
          </h1>
          {years ? (
            <p className="mt-5 font-serif text-2xl text-muted italic">
              {years}
            </p>
          ) : null}
          <a
            href={artist.sourceUrl}
            target="_blank"
            rel={EXTERNAL_REL}
            className="mt-8 inline-flex items-center gap-2 border-b border-ink/30 pb-1 text-sm transition-colors duration-300 ease-gallery hover:border-ink"
          >
            {t.viewAtMuseum}
            <ArrowUpRight className="size-4" />
            <span className="sr-only">{dict.site.opensInNewTab}</span>
          </a>
        </header>

        {artist.description ? (
          <div className="animate-rise [animation-delay:calc(var(--intro-delay)+260ms)] lg:pt-10">
            <div
              lang="en"
              className="space-y-4 font-serif text-lg leading-8 text-ink/90 sm:text-xl sm:leading-9"
            >
              {artist.description.map((paragraph, index) => (
                <p key={index}>
                  {paragraph.map((run, runIndex) =>
                    run.italic ? <em key={runIndex}>{run.text}</em> : run.text,
                  )}
                </p>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted">{t.bioCredit}</p>
          </div>
        ) : null}
      </Container>

      <Container className="mt-20 sm:mt-28">
        <section
          id="works"
          aria-labelledby="works-heading"
          className="scroll-mt-20"
        >
          <Reveal>
            <h2
              id="works-heading"
              className="border-b border-line pb-4 font-serif text-3xl sm:text-4xl"
            >
              {t.worksHeading}
            </h2>
          </Reveal>
          <Suspense
            key={page}
            fallback={<ResultsSkeleton label={dict.explore.loading} />}
          >
            <ArtistWorks
              artistId={artist.id}
              page={page}
              locale={locale}
              dict={dict}
            />
          </Suspense>
        </section>
      </Container>
    </article>
  );
}

async function ArtistWorks({
  artistId,
  page,
  locale,
  dict,
}: {
  artistId: number;
  page: number;
  locale: Locale;
  dict: Dictionary;
}) {
  const query = { ...EMPTY_QUERY, page };
  let result;
  try {
    result = await searchArtworks(query, {}, { artistId });
  } catch (caught) {
    const reason: ResultsErrorReason =
      isAicError(caught) && caught.code === "rate_limited"
        ? "rate_limited"
        : isAicError(caught) && caught.code === "timeout"
          ? "timeout"
          : "generic";
    return (
      <ResultsError
        reason={reason}
        retryable={isAicError(caught) ? caught.retryable : true}
      />
    );
  }

  if (result.total === 0)
    return <p className="mt-10 max-w-xl text-muted">{dict.artist.noWorks}</p>;

  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const base = localizePath(locale, `/artists/${artistId}`);
  return (
    <>
      <p role="status" className="mt-4 text-sm text-muted">
        {format(dict.ways.worksCount, { count: number.format(result.total) })}
      </p>
      <ArtworkWall
        artworks={result.artworks}
        locale={locale}
        className="mt-12"
      />
      <Pagination
        locale={locale}
        dict={dict}
        query={query}
        totalPages={result.totalPages}
        hrefFor={(next) => `${base}${next > 1 ? `?page=${next}` : ""}#works`}
      />
    </>
  );
}
