"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search } from "@/components/ui/icons";
import { ARTWORK_TYPES, MAX_QUERY_LENGTH } from "@/lib/artic/config";
import { searchHref } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { cn } from "@/lib/utils";

/** Typing pauses this long before the search runs on its own. */
const DEBOUNCE_MS = 450;
/** Single letters match almost everything; wait for a second one before searching. */
const MIN_AUTO_LENGTH = 2;

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

const chip =
  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors duration-200 ease-gallery";

export function ExploreControls({ query }: { query: SearchQuery }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState(query.q);
  // The keyword in the URL changes when we search and when the visitor goes back or forward.
  // Only the second should overwrite what is in the box.
  const [syncedQ, setSyncedQ] = useState(query.q);
  const [pushedQ, setPushedQ] = useState<string | null>(null);
  if (query.q !== syncedQ) {
    setSyncedQ(query.q);
    if (query.q !== pushedQ) setValue(query.q);
  }

  useEffect(() => {
    const next = clean(value);
    if (next === query.q || (next.length > 0 && next.length < MIN_AUTO_LENGTH))
      return;
    const timer = setTimeout(() => {
      setPushedQ(next);
      startTransition(() =>
        router.push(searchHref({ q: next, type: query.type }), {
          scroll: false,
        }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, query.q, query.type, router]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = clean(value);
    setPushedQ(next);
    startTransition(() =>
      router.push(searchHref({ q: next, type: query.type }), { scroll: false }),
    );
  };

  const hasFilters = Boolean(query.q || query.type);

  return (
    <div className="flex flex-col gap-6">
      {/* Works without JavaScript as a plain GET form. */}
      <form
        role="search"
        aria-label="Search artworks"
        action="/"
        method="get"
        onSubmit={submit}
      >
        <label htmlFor="explore-q" className="sr-only">
          Search artworks
        </label>
        <div className="relative">
          <Search className="pointer-events-none absolute top-1/2 left-0 size-5 -translate-y-1/2 text-muted" />
          <input
            id="explore-q"
            name="q"
            type="search"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            maxLength={MAX_QUERY_LENGTH}
            placeholder="Search by artist, title or subject"
            autoComplete="off"
            enterKeyHint="search"
            className="min-h-12 w-full border-0 border-b border-ink/30 bg-transparent pl-9 font-serif text-xl text-ink transition-colors duration-200 ease-gallery placeholder:text-muted/80 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-2xl"
          />
          {query.type ? (
            <input type="hidden" name="type" value={query.type} />
          ) : null}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="sr-only" id="type-filter-label">
          Filter by type
        </span>
        <ul
          aria-labelledby="type-filter-label"
          className="flex flex-wrap gap-2"
        >
          {[{ slug: null, label: "All" }, ...ARTWORK_TYPES].map((type) => {
            const selected = query.type === type.slug;
            return (
              <li key={type.label}>
                <Link
                  href={searchHref({ q: query.q, type: type.slug })}
                  scroll={false}
                  prefetch={false}
                  aria-current={selected ? "true" : undefined}
                  className={cn(
                    chip,
                    selected
                      ? "border-ink bg-ink text-paper"
                      : "border-ink/25 text-ink hover:border-ink",
                  )}
                >
                  {type.label}
                </Link>
              </li>
            );
          })}
        </ul>
        {hasFilters ? (
          <Link
            href={searchHref({})}
            scroll={false}
            prefetch={false}
            className="ml-1 min-h-10 px-2 py-2 text-sm text-muted underline underline-offset-4 hover:text-ink"
          >
            Clear filters
          </Link>
        ) : null}
        <p role="status" className="ml-auto text-sm text-muted">
          {isPending ? "Searching…" : ""}
        </p>
      </div>
    </div>
  );
}
