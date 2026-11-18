import { Suspense } from "react";
import type { Metadata } from "next";
import { ExploreSection } from "@/components/discover/explore-section";
import { HeroGallery } from "@/components/discover/hero-gallery";
import { Statement } from "@/components/discover/statement";
import { WaysIn } from "@/components/discover/ways-in";
import { getFeaturedArtworks } from "@/lib/artic/featured";
import { parseSearchQuery } from "@/lib/artic/queries";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const { query } = parseSearchQuery(await searchParams);

  const type = query.type ? dict.types[query.type] : null;
  const label = [
    query.q && (locale === "en" ? `“${query.q}”` : `「${query.q}」`),
    type,
  ]
    .filter(Boolean)
    .join(" · ");
  if (!label) {
    return {
      title: { absolute: dict.meta.homeTitle },
      alternates: languageAlternates(locale, "/"),
    };
  }
  // Search result pages are useful to visitors but thin for search engines.
  return {
    title: format(dict.meta.searchTitle, { query: label }),
    robots: { index: false },
  };
}

function formatDate(isoDate: string, locale: Locale): string {
  return new Date(`${isoDate}T00:00:00Z`).toLocaleDateString(
    LOCALE_TAGS[locale],
    {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    },
  );
}

export default async function Home({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const parsed = parseSearchQuery(await searchParams);
  const featured = await getFeaturedArtworks();
  const live = featured.source === "live";

  return (
    <>
      <HeroGallery
        artworks={featured.artworks}
        eyebrow={live ? dict.hero.eyebrowLive : dict.hero.eyebrowSnapshot}
        note={
          live || !featured.snapshotDate
            ? undefined
            : format(dict.hero.snapshotNote, {
                date: formatDate(featured.snapshotDate, locale),
              })
        }
      />
      <Statement locale={locale} dict={dict} />
      <Suspense fallback={null}>
        <WaysIn locale={locale} dict={dict} />
      </Suspense>
      <ExploreSection
        locale={locale}
        dict={dict}
        query={parsed.query}
        error={parsed.ok ? undefined : parsed.error}
      />
    </>
  );
}
