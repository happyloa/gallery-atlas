import Link from "next/link";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { searchArtworks } from "@/lib/artic/artworks";
import type { SearchResult } from "@/lib/artic/artworks";
import { isAicError } from "@/lib/artic/client";
import { MAX_PAGE, PAGE_SIZE } from "@/lib/artic/config";
import type { SearchQueryError } from "@/lib/artic/queries";
import { searchHref } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { Pagination } from "./pagination";
import { ResultsError } from "./results-error";
import type { ResultsErrorReason } from "./results-error";

interface ResultsProps {
  locale: Locale;
  dict: Dictionary;
  query: SearchQuery;
  error?: SearchQueryError;
}

function Summary({
  locale,
  dict,
  query,
  result,
}: Omit<ResultsProps, "error"> & { result: SearchResult }) {
  const t = dict.explore;
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);
  const typeLabel = query.type ? dict.types[query.type] : "";
  const type = locale === "en" ? typeLabel.toLowerCase() : typeLabel;
  const template = query.q
    ? query.type
      ? t.summaryTypeQuery
      : t.summaryQuery
    : query.type
      ? t.summaryType
      : t.summaryAll;
  const from = (query.page - 1) * PAGE_SIZE + 1;
  const to = from + result.artworks.length - 1;

  return (
    <div className="mt-14 flex flex-col gap-2 border-y border-line py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p role="status">
        {format(template, {
          count: number.format(result.total),
          type,
          q: query.q,
        })}
        {result.artworks.length > 0 ? (
          <span className="text-muted">
            {format(t.showing, {
              from: number.format(from),
              to: number.format(to),
            })}
          </span>
        ) : null}
      </p>
      {result.limited ? (
        <p className="text-muted">
          {format(t.limited, {
            count: number.format(result.totalPages * PAGE_SIZE),
          })}
        </p>
      ) : null}
    </div>
  );
}

export async function ExploreResults({
  locale,
  dict,
  query,
  error,
}: ResultsProps) {
  const t = dict.explore;
  const backToFirst = (
    <Link
      href={searchHref(locale, { ...query, page: 1 })}
      prefetch={false}
      className={buttonStyles()}
    >
      {t.backToFirstPage}
    </Link>
  );

  // Bad page numbers are answered here, without calling the museum's API.
  if (error) {
    const outOfRange = error.code === "page_out_of_range";
    return (
      <EmptyState
        className="py-16 sm:py-20"
        eyebrow={outOfRange ? t.pastEndEyebrow : t.invalidPageEyebrow}
        title={
          outOfRange
            ? format(t.pageOutOfRangeTitle, { max: MAX_PAGE })
            : t.invalidPageTitle
        }
        action={backToFirst}
      >
        <p>
          {outOfRange
            ? format(t.pageOutOfRangeBody, {
                count: MAX_PAGE * PAGE_SIZE,
                max: MAX_PAGE,
              })
            : t.invalidPageBody}
        </p>
      </EmptyState>
    );
  }

  let result: SearchResult;
  try {
    result = await searchArtworks(query);
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

  if (result.total === 0) {
    return (
      <>
        <Summary locale={locale} dict={dict} query={query} result={result} />
        <EmptyState
          className="py-16 sm:py-20"
          title={
            query.q ? format(t.emptyQueryTitle, { q: query.q }) : t.emptyTitle
          }
          action={
            <Link
              href={searchHref(locale, {})}
              prefetch={false}
              className={buttonStyles({ variant: "secondary" })}
            >
              {t.clearFilters}
            </Link>
          }
        >
          <p>{t.emptyHint}</p>
        </EmptyState>
      </>
    );
  }

  if (query.page > result.totalPages) {
    return (
      <EmptyState
        className="py-16 sm:py-20"
        eyebrow={t.pastEndEyebrow}
        title={
          result.totalPages === 1
            ? t.pastEndTitleOne
            : format(t.pastEndTitleOther, { count: result.totalPages })
        }
        action={backToFirst}
      />
    );
  }

  return (
    <>
      <Summary locale={locale} dict={dict} query={query} result={result} />
      <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result.artworks.map((artwork) => (
          <li key={artwork.id}>
            <ArtworkCard artwork={artwork} locale={locale} />
          </li>
        ))}
      </ul>
      <Pagination
        locale={locale}
        dict={dict}
        query={query}
        totalPages={result.totalPages}
      />
    </>
  );
}
