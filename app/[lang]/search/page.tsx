import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import {
  FilterChips,
  IndexList,
  indexLinkClass,
  indexTitleClass,
  KeywordForm,
  ListPagination,
  OutLink,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { searchHref } from "@/lib/artic/search-url";
import {
  SEARCH_TAB_NAMES,
  SEARCH_TABS,
  searchSite,
} from "@/lib/artic/site-search";
import type { SearchTab } from "@/lib/artic/site-search";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  attempt,
  keywordParam,
  languageAlternates,
  localeOf,
  pageParam,
  stringParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.siteSearch.heading,
    description: dict.siteSearch.metaDescription,
    alternates: languageAlternates("/search"),
    robots: { index: false },
  };
}

export default async function SearchPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.siteSearch;
  const query = await searchParams;
  const q = keywordParam(query);
  const page = pageParam(query);
  const rawTab = stringParam(query, "tab") ?? "all";
  const tab: SearchTab = rawTab in SEARCH_TABS ? (rawTab as SearchTab) : "all";

  const base = localizePath(locale, "/search");
  const result = q ? await attempt(() => searchSite(q, tab, page)) : null;
  const data = result?.data ?? null;
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
        <div className="mt-10">
          <KeywordForm
            action={base}
            label={t.label}
            placeholder={t.placeholder}
            submit={dict.common.searchSubmit}
            value={q}
            hidden={{ tab: tab === "all" ? undefined : tab }}
          />
        </div>
      </Container>

      {q ? (
        <Container className="mt-12">
          <Link
            href={searchHref(locale, { q })}
            prefetch={false}
            className="group inline-flex items-center gap-2 text-sm underline-offset-4 hover:underline"
          >
            {format(t.inCollection, { q })}
            <ArrowRight
              aria-hidden="true"
              className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
            />
          </Link>

          {result?.failure ? <ResultsError {...result.failure} /> : null}

          {data ? (
            <>
              <div className="mt-8">
                <FilterChips
                  label={t.tabLabel}
                  items={SEARCH_TAB_NAMES.map((name) => ({
                    key: name,
                    href: withQuery(base, {
                      q,
                      tab: name === "all" ? null : name,
                    }),
                    label: t.tabs[name],
                    active: name === tab,
                    count: number.format(data.tabCounts[name]),
                  }))}
                />
              </div>
              <div className="mt-10">
                <ResultCount total={data.total} locale={locale} dict={dict} />
              </div>
              {data.items.length > 0 ? (
                <div className="mt-4">
                  <IndexList>
                    {data.items.map((hit) => {
                      const kind =
                        t.kinds[hit.resource as keyof typeof t.kinds] ?? null;
                      const body = (
                        <span>
                          {kind ? (
                            <span className="block text-xs tracking-[0.12em] text-muted uppercase">
                              {kind}
                            </span>
                          ) : null}
                          <span lang="en" className={`mt-1 ${indexTitleClass}`}>
                            {hit.title}
                          </span>
                        </span>
                      );
                      return (
                        <li key={hit.key}>
                          {hit.external ? (
                            <OutLink
                              href={hit.href}
                              dict={dict}
                              className={indexLinkClass}
                            >
                              {body}
                            </OutLink>
                          ) : (
                            <Link
                              href={localizePath(locale, hit.href)}
                              prefetch={false}
                              className={indexLinkClass}
                            >
                              {body}
                            </Link>
                          )}
                        </li>
                      );
                    })}
                  </IndexList>
                </div>
              ) : (
                <p className="mt-6 text-muted">
                  {format(dict.common.noMatch, { q })}
                </p>
              )}
              <ListPagination
                locale={locale}
                dict={dict}
                page={page}
                totalPages={data.totalPages}
                hrefFor={(next) =>
                  withQuery(base, {
                    q,
                    tab: tab === "all" ? null : tab,
                    page: next,
                  })
                }
              />
            </>
          ) : null}
        </Container>
      ) : null}
    </div>
  );
}
