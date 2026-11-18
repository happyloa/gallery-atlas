import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache, Suspense } from "react";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { Pagination } from "@/components/discover/pagination";
import { ResultsError } from "@/components/discover/results-error";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { Container } from "@/components/ui/container";
import { ArrowLeft } from "@/components/ui/icons";
import { searchArtworks } from "@/lib/artic/artworks";
import { describeFailure } from "@/lib/artic/error-reason";
import { getGallery } from "@/lib/artic/museum";
import {
  EMPTY_QUERY,
  parseGalleryId,
  parseSearchQuery,
} from "@/lib/artic/queries";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format, formatCount } from "@/lib/i18n/format";

type Params = Promise<{ lang: string; id: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

const loadGallery = cache(async (rawId: string) => {
  const id = parseGalleryId(rawId);
  if (id === null) return { status: "not_found" as const };
  return getGallery(id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const dict = getDictionary(localeOf(lang));
  const lookup = await loadGallery(id).catch(() => null);
  if (lookup?.status !== "ok") return { title: dict.meta.notFoundTitle };
  const { gallery } = lookup;
  return {
    title: gallery.name,
    description: format(dict.gallery.metaDescription, {
      gallery: gallery.name,
    }),
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          LOCALE_TAGS[l],
          localizePath(l, `/galleries/${gallery.id}`),
        ]),
      ),
    },
  };
}

export default async function GalleryPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { lang, id: rawId } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.gallery;
  const lookup = await loadGallery(rawId);
  if (lookup.status !== "ok") notFound();
  const { gallery } = lookup;
  const parsed = parseSearchQuery(await searchParams);
  const page = parsed.ok ? parsed.query.page : 1;

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <Link
          href={localizePath(locale, "/galleries")}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {dict.galleries.all}
        </Link>
      </Container>

      <Container className="mt-10 lg:mt-16">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1
            lang="en"
            className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl lg:text-7xl"
          >
            {gallery.name}
          </h1>
          <p className="mt-5 font-serif text-2xl text-muted italic">
            {[
              gallery.floor ? format(t.floor, { floor: gallery.floor }) : null,
              gallery.isClosed ? t.closed : null,
            ]
              .filter(Boolean)
              .join(" · ")}
          </p>
        </header>
      </Container>

      <Container className="mt-16 sm:mt-24">
        <section
          id="works"
          aria-labelledby="works-heading"
          className="scroll-mt-20"
        >
          <h2
            id="works-heading"
            className="border-b border-line pb-4 font-serif text-3xl sm:text-4xl"
          >
            {t.worksHeading}
          </h2>
          <Suspense
            key={page}
            fallback={<ResultsSkeleton label={dict.explore.loading} />}
          >
            <GalleryWorks
              galleryId={gallery.id}
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

async function GalleryWorks({
  galleryId,
  page,
  locale,
  dict,
}: {
  galleryId: number;
  page: number;
  locale: Locale;
  dict: Dictionary;
}) {
  const query = { ...EMPTY_QUERY, page };
  let result;
  try {
    result = await searchArtworks(query, {}, { galleryId });
  } catch (caught) {
    return <ResultsError {...describeFailure(caught)} />;
  }
  if (result.total === 0)
    return <p className="mt-10 max-w-xl text-muted">{dict.gallery.noWorks}</p>;

  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const base = localizePath(locale, `/galleries/${galleryId}`);
  return (
    <>
      <p role="status" className="mt-4 text-sm text-muted">
        {formatCount(
          dict.ways.worksCountOne,
          dict.ways.worksCount,
          result.total,
          number.format(result.total),
        )}
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
