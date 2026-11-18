import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { searchHref } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

const step = buttonStyles({ variant: "secondary", size: "sm" });
const disabled = cn(step, "pointer-events-none opacity-40");

interface PaginationProps {
  locale: Locale;
  dict: Dictionary;
  query: SearchQuery;
  totalPages: number;
  /** Where page `n` lives. Defaults to Explore with the same search. */
  hrefFor?: (page: number) => string;
}

/** Previous / next links that keep the search. No prefetch: each page is an API call. */
export function Pagination({
  locale,
  dict,
  query,
  totalPages,
  hrefFor = (page) => searchHref(locale, { ...query, page }),
}: PaginationProps) {
  if (totalPages <= 1) return null;
  const t = dict.explore;
  const hasPrevious = query.page > 1;
  const hasNext = query.page < totalPages;

  return (
    <nav
      aria-label={t.paginationLabel}
      className="mt-20 flex items-center justify-between gap-4 border-t border-line pt-6"
    >
      {hasPrevious ? (
        <Link
          href={hrefFor(query.page - 1)}
          prefetch={false}
          className={step}
          rel="prev"
        >
          <ChevronLeft className="size-4" />
          {t.previousPage}
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          <ChevronLeft className="size-4" />
          {t.previousPage}
        </span>
      )}
      <p className="text-sm text-muted">
        {format(t.pageOf, { page: query.page, total: totalPages })}
      </p>
      {hasNext ? (
        <Link
          href={hrefFor(query.page + 1)}
          prefetch={false}
          className={step}
          rel="next"
        >
          {t.nextPage}
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          {t.nextPage}
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
