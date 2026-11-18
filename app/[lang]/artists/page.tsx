import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import {
  FilterChips,
  KeywordForm,
  ListPagination,
  PageHeader,
  ResultCount,
} from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { getArtistIndex, getArtistTypes } from "@/lib/artic/directory";
import type { ArtistRow } from "@/lib/artic/directory";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format, formatCount } from "@/lib/i18n/format";
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
    title: dict.artistIndex.heading,
    description: dict.artistIndex.metaDescription,
    alternates: languageAlternates("/artists"),
  };
}

function years(artist: ArtistRow, dict: Dictionary): string | null {
  const { birthYear: birth, deathYear: death } = artist;
  if (birth !== null && death !== null)
    return format(dict.artist.lifespan, { birth, death });
  if (birth !== null) return format(dict.artist.born, { birth });
  if (death !== null) return format(dict.artist.died, { death });
  return null;
}

export default async function ArtistsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.artistIndex;
  const query = await searchParams;
  const q = keywordParam(query);
  const page = pageParam(query);
  const rawType = stringParam(query, "type");
  const type = rawType && /^\d{1,3}$/.test(rawType) ? Number(rawType) : null;

  const base = localizePath(locale, "/artists");
  const [result, types] = await Promise.all([
    attempt(() => getArtistIndex({ keyword: q, type, page })),
    getArtistTypes().catch(() => []),
  ]);
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
        <div className="mt-10 space-y-6">
          <KeywordForm
            action={base}
            label={t.searchLabel}
            placeholder={t.placeholder}
            submit={dict.common.searchSubmit}
            value={q}
            hidden={{ type: type !== null ? String(type) : undefined }}
          />
          {types.length > 0 ? (
            <FilterChips
              label={dict.common.filterLabel}
              items={[
                {
                  key: "all",
                  href: withQuery(base, { q }),
                  label: t.mostWorks,
                  active: type === null,
                },
                ...types.map((item) => ({
                  key: String(item.id),
                  href: withQuery(base, { q, type: item.id }),
                  label: item.title,
                  lang: "en",
                  active: item.id === type,
                  count: number.format(item.count),
                })),
              ]}
            />
          ) : null}
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
              <ul className="mt-6 grid gap-x-10 border-t border-line sm:grid-cols-2 lg:grid-cols-3">
                {result.data.items.map((artist, index) => {
                  const life = years(artist, dict);
                  return (
                    <Reveal
                      as="li"
                      key={artist.id}
                      delay={(index % 3) * 60}
                      className="border-b border-line"
                    >
                      <Link
                        href={localizePath(locale, `/artists/${artist.id}`)}
                        prefetch={false}
                        className="group block py-5"
                      >
                        <span
                          lang="en"
                          className="block font-serif text-2xl leading-snug group-hover:underline group-hover:underline-offset-4"
                        >
                          {artist.name}
                        </span>
                        <span className="mt-1 block text-sm text-muted">
                          {[
                            life,
                            artist.works !== null
                              ? formatCount(
                                  dict.common.worksOne,
                                  dict.common.works,
                                  artist.works,
                                  number.format(artist.works),
                                )
                              : null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </span>
                      </Link>
                    </Reveal>
                  );
                })}
              </ul>
            )}
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) => withQuery(base, { q, type, page: next })}
            />
          </>
        ) : null}
      </Container>
    </div>
  );
}
