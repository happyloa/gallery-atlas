import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "@/components/ui/icons";
import { searchHref } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { cn } from "@/lib/utils";

const step = buttonStyles({ variant: "secondary", size: "sm" });
const disabled = cn(step, "pointer-events-none opacity-40");

/** Previous / next links that keep the keyword and type. No prefetch: each page is an API call. */
export function Pagination({
  query,
  totalPages,
}: {
  query: SearchQuery;
  totalPages: number;
}) {
  if (totalPages <= 1) return null;
  const hasPrevious = query.page > 1;
  const hasNext = query.page < totalPages;

  return (
    <nav
      aria-label="Pagination"
      className="mt-20 flex items-center justify-between gap-4 border-t border-line pt-6"
    >
      {hasPrevious ? (
        <Link
          href={searchHref({ ...query, page: query.page - 1 })}
          prefetch={false}
          className={step}
          rel="prev"
        >
          <ChevronLeft className="size-4" />
          Previous
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          <ChevronLeft className="size-4" />
          Previous
        </span>
      )}
      <p className="text-sm text-muted">
        Page {query.page} of {totalPages}
      </p>
      {hasNext ? (
        <Link
          href={searchHref({ ...query, page: query.page + 1 })}
          prefetch={false}
          className={step}
          rel="next"
        >
          Next
          <ChevronRight className="size-4" />
        </Link>
      ) : (
        <span className={disabled} aria-disabled="true">
          Next
          <ChevronRight className="size-4" />
        </span>
      )}
    </nav>
  );
}
