import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsError } from "@/components/discover/results-error";
import {
  BackLink,
  Credit,
  IndexList,
  indexLinkClass,
  indexTitleClass,
  KeywordForm,
  ListPagination,
  MUSEUM_SITE,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { getLibraryList, isLibraryKind } from "@/lib/artic/library";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  attempt,
  keywordParam,
  languageAlternates,
  localeOf,
  pageParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string; kind: string }>;

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}): Promise<Metadata> {
  const { lang, kind } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  if (!isLibraryKind(kind)) return { title: dict.meta.notFoundTitle };
  const query = await searchParams;
  return {
    title: dict.read.kinds[kind],
    description: dict.read.metaDescription,
    alternates: languageAlternates(locale, `/read/${kind}`, {
      q: keywordParam(query),
      page: pageParam(query) ?? 1,
    }),
  };
}

export default async function LibraryKindPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const { lang, kind } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  if (!isLibraryKind(kind)) notFound();
  const t = dict.read;
  const query = await searchParams;
  const q = keywordParam(query);
  const page = pageParam(query);
  // Past the last page the museum's search can show: no such page, and no request for it.
  if (page === null) notFound();
  const base = localizePath(locale, `/read/${kind}`);
  const title = t.kinds[kind];
  const result = await attempt(() =>
    getLibraryList(kind, { keyword: q, page }),
  );

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink href={localizePath(locale, "/read")} label={t.heading} />
      </Container>
      <Container className="mt-6">
        <PageHeader eyebrow={t.heading} title={title} />
        <div className="mt-10">
          <KeywordForm
            action={base}
            label={format(t.searchLabel, { kind: title })}
            placeholder={dict.common.keyword}
            submit={dict.common.searchSubmit}
            value={q}
          />
        </div>
      </Container>

      <Container className="mt-12">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {result.data ? (
          <>
            <ResultCount
              total={result.data.total}
              locale={locale}
              dict={dict}
            />
            {result.data.items.length === 0 ? (
              <p className="mt-6 text-muted">
                {q ? format(dict.common.noMatch, { q }) : dict.common.nothing}
              </p>
            ) : (
              <div className="mt-4">
                <IndexList>
                  {result.data.items.map((row) => (
                    <li key={row.id}>
                      <Link
                        href={`${base}/${row.id}`}
                        prefetch={false}
                        className={indexLinkClass}
                      >
                        <span lang="en" className="max-w-3xl">
                          <span className={indexTitleClass}>{row.title}</span>
                          {row.context ? (
                            <span className="mt-1 block text-sm text-muted">
                              {row.context}
                            </span>
                          ) : null}
                          {row.excerpt ? (
                            <span className="mt-2 block text-sm leading-6 text-ink/75">
                              {row.excerpt}
                            </span>
                          ) : null}
                        </span>
                        <ArrowRight
                          aria-hidden="true"
                          className="size-4 shrink-0 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
                        />
                      </Link>
                    </li>
                  ))}
                </IndexList>
              </div>
            )}
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) => withQuery(base, { q, page: next })}
            />
            {/* The rows quote the museum's own text. */}
            {result.data.items.length > 0 ? (
              <Credit
                text={t.credit}
                dict={dict}
                href={MUSEUM_SITE}
                className="mt-16 text-xs text-muted"
              />
            ) : null}
          </>
        ) : null}
      </Container>
    </div>
  );
}
