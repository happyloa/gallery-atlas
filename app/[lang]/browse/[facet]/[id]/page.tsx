import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { ResultsError } from "@/components/discover/results-error";
import {
  BackLink,
  ListPagination,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { searchArtworks } from "@/lib/artic/artworks";
import { getFacetTerm, isWorkFacet, parseFacetId } from "@/lib/artic/directory";
import { EMPTY_QUERY } from "@/lib/artic/search-url";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  attempt,
  languageAlternates,
  localeOf,
  pageParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string; facet: string; id: string }>;

const loadTerm = cache(async (facet: string, rawId: string) => {
  if (!isWorkFacet(facet)) return null;
  const id = parseFacetId(facet, rawId);
  return id ? getFacetTerm(facet, id) : null;
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, facet, id } = await params;
  const dict = getDictionary(localeOf(lang));
  const term = await loadTerm(facet, id).catch(() => null);
  if (!term) return { title: dict.meta.notFoundTitle };
  return {
    title: term.title,
    alternates: languageAlternates(`/browse/${facet}/${id}`),
  };
}

export default async function FacetTermPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const { lang, facet, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const term = await loadTerm(facet, id);
  if (!term || !isWorkFacet(facet)) notFound();
  const page = pageParam(await searchParams);
  const base = localizePath(locale, `/browse/${facet}/${id}`);
  const facetTitle = dict.browse.facets[facet];

  const result = await attempt(() =>
    searchArtworks({ ...EMPTY_QUERY, page }, {}, { term: term.term }),
  );

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink
          href={localizePath(locale, `/browse/${facet}`)}
          label={facetTitle}
        />
      </Container>
      <Container className="mt-6">
        <PageHeader eyebrow={facetTitle} title={term.title} titleLang="en" />
      </Container>
      <Container className="mt-12">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {result.data?.total === 0 ? (
          <p className="text-muted">{dict.browse.noWorks}</p>
        ) : null}
        {result.data && result.data.total > 0 ? (
          <>
            <ResultCount
              total={result.data.total}
              locale={locale}
              dict={dict}
            />
            <ArtworkWall
              artworks={result.data.artworks}
              locale={locale}
              className="mt-10"
            />
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) => withQuery(base, { page: next })}
            />
          </>
        ) : null}
      </Container>
    </div>
  );
}
