import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ResultsError } from "@/components/discover/results-error";
import {
  BackLink,
  KeywordForm,
  OutLink,
  PageHeader,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import {
  getFacetTerms,
  getPlaceRows,
  getVocabularies,
  isBrowseFacet,
  isWorkFacet,
} from "@/lib/artic/directory";
import type { FacetTerm, PlaceRow, Vocabulary } from "@/lib/artic/directory";
import { searchHref } from "@/lib/artic/search-url";
import { placeByKey } from "@/lib/geo/places";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import {
  attempt,
  keywordParam,
  languageAlternates,
  localeOf,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string; facet: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, facet } = await params;
  const dict = getDictionary(localeOf(lang));
  if (!isBrowseFacet(facet)) return { title: dict.meta.notFoundTitle };
  return {
    title: dict.browse.facets[facet],
    description: dict.browse.metaDescription,
    alternates: languageAlternates(`/browse/${facet}`),
  };
}

const rowClass =
  "flex min-h-11 items-baseline justify-between gap-4 border-b border-line py-2.5 text-[0.9375rem]";

function TermGrid({
  facet,
  terms,
  locale,
}: {
  facet: string;
  terms: FacetTerm[];
  locale: Locale;
}) {
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
      {terms.map((term) => (
        <li key={term.id}>
          <Link
            href={localizePath(locale, `/browse/${facet}/${term.id}`)}
            prefetch={false}
            className={`${rowClass} underline-offset-4 hover:underline`}
          >
            <span lang="en">{term.title}</span>
            {term.works !== null ? (
              <span className="text-sm text-muted tabular-nums">
                {number.format(term.works)}
              </span>
            ) : null}
          </Link>
        </li>
      ))}
    </ul>
  );
}

function PlaceGrid({
  places,
  locale,
  dict,
}: {
  places: PlaceRow[];
  locale: Locale;
  dict: Dictionary;
}) {
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  return (
    <ul className="grid gap-x-10 sm:grid-cols-2 lg:grid-cols-3">
      {places.map((place) => {
        const known = placeByKey(place.key);
        const name = known?.[locale === "en" ? "en" : "zh"] ?? place.title;
        const label = (
          <span lang={known && locale !== "en" ? undefined : "en"}>{name}</span>
        );
        return (
          <li key={place.key} className={rowClass}>
            {place.works > 0 ? (
              <Link
                href={searchHref(locale, { place: place.key })}
                prefetch={false}
                className="underline-offset-4 hover:underline"
              >
                {label}
              </Link>
            ) : (
              label
            )}
            <span className="flex items-baseline gap-3 text-sm text-muted tabular-nums">
              {place.tgnUrl ? (
                <OutLink
                  href={place.tgnUrl}
                  dict={dict}
                  className="inline-flex items-center gap-1 underline-offset-4 hover:underline"
                >
                  {dict.browse.tgn}
                </OutLink>
              ) : null}
              {place.works > 0 ? number.format(place.works) : null}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function VocabularyLists({
  vocabularies,
  dict,
}: {
  vocabularies: Vocabulary[];
  dict: Dictionary;
}) {
  return (
    <div className="grid gap-12 md:grid-cols-2">
      {vocabularies.map((vocabulary) => (
        <section
          key={vocabulary.name}
          aria-labelledby={`vocabulary-${vocabulary.name}`}
        >
          <h2
            id={`vocabulary-${vocabulary.name}`}
            className="border-b border-line pb-3 font-serif text-3xl"
          >
            {dict.browse.vocabularies[vocabulary.name]}
          </h2>
          <ul lang="en" className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-sm">
            {vocabulary.terms.map((term) => (
              <li key={term}>{term}</li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default async function FacetPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const { lang, facet } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  if (!isBrowseFacet(facet)) notFound();
  const t = dict.browse;
  const q = keywordParam(await searchParams);
  const title = t.facets[facet];
  const base = localizePath(locale, `/browse/${facet}`);

  const result = await attempt(async () => ({
    terms: isWorkFacet(facet) ? await getFacetTerms(facet, q) : null,
    places: facet === "places" ? await getPlaceRows(q) : null,
    vocabularies: facet === "vocabulary" ? await getVocabularies() : null,
  }));
  const data = result.data;
  const empty = (data?.terms ?? data?.places)?.length === 0;

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink href={localizePath(locale, "/browse")} label={t.heading} />
      </Container>
      <Container className="mt-6">
        <PageHeader eyebrow={t.heading} title={title} />
        {facet !== "vocabulary" ? (
          <div className="mt-10">
            <KeywordForm
              action={base}
              label={format(t.searchLabel, { facet: title })}
              placeholder={dict.common.keyword}
              submit={dict.common.searchSubmit}
              value={q}
            />
          </div>
        ) : null}
      </Container>

      <Container className="mt-12">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {empty ? (
          <p className="text-muted">
            {q ? format(dict.common.noMatch, { q }) : dict.common.nothing}
          </p>
        ) : null}
        {data?.terms?.length ? (
          <TermGrid facet={facet} terms={data.terms} locale={locale} />
        ) : null}
        {data?.places?.length ? (
          <PlaceGrid places={data.places} locale={locale} dict={dict} />
        ) : null}
        {data?.vocabularies ? (
          <VocabularyLists vocabularies={data.vocabularies} dict={dict} />
        ) : null}
        {facet === "places" ? (
          <p className="mt-10 max-w-2xl text-xs text-muted">{t.placeCredit}</p>
        ) : null}
      </Container>
    </div>
  );
}
