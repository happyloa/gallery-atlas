import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { ResultsError } from "@/components/discover/results-error";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import {
  exhibitionDates,
  ExhibitionStatus,
} from "@/components/museum/exhibition-meta";
import { Container } from "@/components/ui/container";
import { ArrowLeft, ArrowUpRight } from "@/components/ui/icons";
import { getArtworksByIds } from "@/lib/artic/artworks";
import { MAX_SHARED_WORKS } from "@/lib/artic/config";
import { describeFailure } from "@/lib/artic/error-reason";
import { getMuseumExhibition } from "@/lib/artic/museum";
import { parseId } from "@/lib/artic/queries";
import type { MuseumExhibition } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { languageAlternates, localeOf } from "@/lib/page-params";
import { EXTERNAL_REL } from "@/lib/utils";

type Params = Promise<{ lang: string; id: string }>;

const loadExhibition = cache(async (rawId: string) => {
  const id = parseId(rawId);
  if (id === null) return { status: "not_found" as const };
  return getMuseumExhibition(id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const lookup = await loadExhibition(id).catch(() => null);
  if (lookup?.status !== "ok") return { title: dict.meta.notFoundTitle };
  const { exhibition } = lookup;
  const first = exhibition.summary?.[0]?.map((run) => run.text).join("") ?? "";
  return {
    title: exhibition.title,
    description:
      first.length > 180
        ? `${first.slice(0, 177).trimEnd()}…`
        : first || undefined,
    alternates: languageAlternates(locale, `/exhibitions/${exhibition.id}`),
  };
}

export default async function MuseumExhibitionPage({
  params,
}: {
  params: Params;
}) {
  const { lang, id: rawId } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.museumExhibitions;
  const lookup = await loadExhibition(rawId);
  if (lookup.status !== "ok") notFound();
  const { exhibition } = lookup;
  const dates = exhibitionDates(exhibition, locale, dict);

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <Link
          href={localizePath(locale, "/exhibitions")}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t.heading}
        </Link>
      </Container>

      <Container className="mt-10 grid gap-12 lg:mt-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)] lg:gap-20">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <ExhibitionStatus exhibition={exhibition} dict={dict} />
          <h1
            lang="en"
            className="mt-5 font-serif text-5xl leading-[1.04] tracking-tight text-balance sm:text-6xl"
          >
            {exhibition.title}
          </h1>
          {dates ? (
            <p className="mt-5 font-serif text-2xl text-muted italic">
              {dates}
            </p>
          ) : null}
          {exhibition.gallery ? (
            <p className="mt-3 text-sm">
              {exhibition.gallery.id ? (
                <Link
                  href={localizePath(
                    locale,
                    `/galleries/${exhibition.gallery.id}`,
                  )}
                  className="underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
                >
                  {exhibition.gallery.name}
                </Link>
              ) : (
                exhibition.gallery.name
              )}
            </p>
          ) : null}
          <a
            href={exhibition.sourceUrl}
            target="_blank"
            rel={EXTERNAL_REL}
            className="mt-8 inline-flex items-center gap-2 border-b border-ink/30 pb-1 text-sm transition-colors duration-300 ease-gallery hover:border-ink"
          >
            {t.viewAtMuseum}
            <ArrowUpRight className="size-4" />
            <span className="sr-only">{dict.site.opensInNewTab}</span>
          </a>
        </header>

        {exhibition.summary ? (
          <div className="animate-rise [animation-delay:calc(var(--intro-delay)+260ms)] lg:pt-10">
            <div
              lang="en"
              className="space-y-4 font-serif text-lg leading-8 text-ink/90 sm:text-xl sm:leading-9"
            >
              {exhibition.summary.map((paragraph, index) => (
                <p key={index}>
                  {paragraph.map((run, runIndex) =>
                    run.italic ? <em key={runIndex}>{run.text}</em> : run.text,
                  )}
                </p>
              ))}
            </div>
            <p className="mt-6 text-xs text-muted">{t.textCredit}</p>
          </div>
        ) : null}
      </Container>

      <Container className="mt-20 sm:mt-28">
        <section aria-labelledby="works-heading">
          <h2
            id="works-heading"
            className="border-b border-line pb-4 font-serif text-3xl sm:text-4xl"
          >
            {t.worksHeading}
          </h2>
          <Suspense fallback={<ResultsSkeleton label={dict.explore.loading} />}>
            <ExhibitionWorks
              exhibition={exhibition}
              locale={locale}
              dict={dict}
            />
          </Suspense>
        </section>
      </Container>
    </article>
  );
}

async function ExhibitionWorks({
  exhibition,
  locale,
  dict,
}: {
  exhibition: MuseumExhibition;
  locale: Locale;
  dict: Dictionary;
}) {
  let artworks;
  try {
    ({ artworks } = await getArtworksByIds(
      exhibition.artworkIds.slice(0, MAX_SHARED_WORKS),
    ));
  } catch (caught) {
    return <ResultsError {...describeFailure(caught)} />;
  }
  if (artworks.length === 0)
    return (
      <p className="mt-10 max-w-xl text-muted">
        {dict.museumExhibitions.noWorks}
      </p>
    );
  return <ArtworkWall artworks={artworks} locale={locale} className="mt-12" />;
}
