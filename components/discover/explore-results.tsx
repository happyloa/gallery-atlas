import Link from "next/link";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { searchArtworks } from "@/lib/artic/artworks";
import type { SearchResult } from "@/lib/artic/artworks";
import { isAicError } from "@/lib/artic/client";
import { ARTWORK_TYPES, MAX_PAGE, PAGE_SIZE } from "@/lib/artic/config";
import type { SearchQueryError } from "@/lib/artic/queries";
import { searchHref } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { Pagination } from "./pagination";
import { ResultsError } from "./results-error";

const number = new Intl.NumberFormat("en-US");

function describe(query: SearchQuery): string {
  const type = ARTWORK_TYPES.find(
    (t) => t.slug === query.type,
  )?.label.toLowerCase();
  const what = type ? `${type} works` : "works";
  return query.q ? `${what} matching “${query.q}”` : what;
}

function Summary({
  query,
  result,
}: {
  query: SearchQuery;
  result: SearchResult;
}) {
  const from = (query.page - 1) * PAGE_SIZE + 1;
  const to = from + result.artworks.length - 1;
  return (
    <div className="mt-14 flex flex-col gap-2 border-y border-line py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
      <p role="status">
        <span className="font-medium">{number.format(result.total)}</span>{" "}
        {describe(query)}
        {result.artworks.length > 0 ? (
          <span className="text-muted">
            {" "}
            · showing {number.format(from)}–{number.format(to)}
          </span>
        ) : null}
      </p>
      {result.limited ? (
        <p className="text-muted">
          Search reaches the first{" "}
          {number.format(result.totalPages * PAGE_SIZE)} results.
        </p>
      ) : null}
    </div>
  );
}

export async function ExploreResults({
  query,
  error,
}: {
  query: SearchQuery;
  error?: SearchQueryError;
}) {
  // Bad page numbers are answered here, without calling the museum's API.
  if (error) {
    return (
      <EmptyState
        className="py-16 sm:py-20"
        eyebrow={
          error.code === "page_out_of_range"
            ? "Past the end"
            : "That page doesn’t exist"
        }
        title={
          error.code === "page_out_of_range"
            ? `Search stops at page ${MAX_PAGE}.`
            : "That page number isn’t valid."
        }
        action={
          <Link
            href={searchHref({ ...query, page: 1 })}
            prefetch={false}
            className={buttonStyles()}
          >
            Back to page 1
          </Link>
        }
      >
        <p>{error.message}</p>
      </EmptyState>
    );
  }

  let result: SearchResult;
  try {
    result = await searchArtworks(query);
  } catch (caught) {
    const retryable = isAicError(caught) ? caught.retryable : true;
    const message =
      isAicError(caught) && caught.code === "rate_limited"
        ? "Too many requests reached the museum at once."
        : isAicError(caught) && caught.code === "timeout"
          ? "The request took too long."
          : "The request failed.";
    return <ResultsError message={message} retryable={retryable} />;
  }

  if (result.total === 0) {
    return (
      <>
        <Summary query={query} result={result} />
        <EmptyState
          className="py-16 sm:py-20"
          title={
            query.q
              ? `Nothing in the collection matches “${query.q}”.`
              : "No works to show here."
          }
          action={
            <Link
              href={searchHref({})}
              prefetch={false}
              className={buttonStyles({ variant: "secondary" })}
            >
              Clear filters
            </Link>
          }
        >
          <p>
            Try a different spelling, an artist’s surname, or a broader type.
          </p>
        </EmptyState>
      </>
    );
  }

  if (query.page > result.totalPages) {
    return (
      <EmptyState
        className="py-16 sm:py-20"
        eyebrow="Past the end"
        title={`This search has ${result.totalPages} ${result.totalPages === 1 ? "page" : "pages"}.`}
        action={
          <Link
            href={searchHref({ ...query, page: 1 })}
            prefetch={false}
            className={buttonStyles()}
          >
            Back to page 1
          </Link>
        }
      />
    );
  }

  return (
    <>
      <Summary query={query} result={result} />
      <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {result.artworks.map((artwork) => (
          <li key={artwork.id}>
            <ArtworkCard artwork={artwork} />
          </li>
        ))}
      </ul>
      <Pagination query={query} totalPages={result.totalPages} />
    </>
  );
}
