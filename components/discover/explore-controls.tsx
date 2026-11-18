"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { Search, X } from "@/components/ui/icons";
import {
  ARTWORK_TYPES,
  COLORS,
  ERAS,
  MAX_QUERY_LENGTH,
} from "@/lib/artic/config";
import type { TagKind } from "@/lib/artic/config";
import {
  FILTER_KEYS,
  hasFilters,
  searchHref,
  toSearchParams,
} from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

/** Typing pauses this long before the search runs on its own. */
const DEBOUNCE_MS = 450;
/** Single letters match almost everything; wait for a second one before searching. */
const MIN_AUTO_LENGTH = 2;

const TAG_KINDS: TagKind[] = ["style", "subject", "theme"];

function clean(value: string): string {
  return value.replace(/\s+/g, " ").trim().slice(0, MAX_QUERY_LENGTH);
}

const chip =
  "inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors duration-200 ease-gallery";
const smallChip =
  "inline-flex min-h-9 items-center rounded-full border px-3 text-[0.8125rem] transition-colors duration-200 ease-gallery";
const chipState = (selected: boolean) =>
  selected
    ? "border-ink bg-ink text-paper"
    : "border-ink/25 text-ink hover:border-ink";

export function ExploreControls({ query }: { query: SearchQuery }) {
  const { locale, dict } = useI18n();
  const t = dict.explore;
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

  /** The current search with some settings changed, back on page 1. */
  const hrefWith = (patch: Partial<SearchQuery>) =>
    searchHref(locale, { ...query, ...patch, page: 1 });

  // Filters other than the keyword, as a stable string for the effect below.
  const filterKey = toSearchParams({ ...query, q: "", page: 1 }).toString();

  useEffect(() => {
    const next = clean(value);
    if (next === query.q || (next.length > 0 && next.length < MIN_AUTO_LENGTH))
      return;
    const timer = setTimeout(() => {
      setPushedQ(next);
      // Same order as searchHref: keyword first, then the filters already in the URL.
      const params = new URLSearchParams(next ? [["q", next]] : []);
      for (const [key, filter] of new URLSearchParams(filterKey))
        params.append(key, filter);
      const search = params.toString();
      startTransition(() =>
        router.push(`/${locale}${search ? `?${search}` : ""}#explore`, {
          scroll: false,
        }),
      );
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [value, query.q, filterKey, router, locale]);

  const submit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const next = clean(value);
    setPushedQ(next);
    startTransition(() =>
      router.push(hrefWith({ q: next }), { scroll: false }),
    );
  };

  const types = [
    { slug: null, label: t.allTypes },
    ...ARTWORK_TYPES.map((type) => ({
      slug: type.slug,
      label: dict.types[type.slug],
    })),
  ];
  const eras = [
    { slug: null, label: t.anyEra },
    ...ERAS.map((era) => ({ slug: era.slug, label: dict.eras[era.slug] })),
  ];
  const activeTags = TAG_KINDS.flatMap((kind) => {
    const tag = query[kind];
    return tag ? [{ kind, value: tag }] : [];
  });

  return (
    <div className="flex flex-col gap-6">
      {/* Works without JavaScript as a plain GET form. */}
      <form
        role="search"
        aria-label={t.searchLabel}
        action={`/${locale}`}
        method="get"
        onSubmit={submit}
      >
        <label htmlFor="explore-q" className="sr-only">
          {t.searchLabel}
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
            placeholder={t.searchPlaceholder}
            autoComplete="off"
            enterKeyHint="search"
            lang="en"
            className="min-h-12 w-full border-0 border-b border-ink/30 bg-transparent pl-9 font-serif text-xl text-ink transition-colors duration-200 ease-gallery placeholder:text-muted/80 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-2xl"
          />
          {FILTER_KEYS.map((key) =>
            query[key] ? (
              <input
                key={key}
                type="hidden"
                name={key}
                value={query[key] ?? ""}
              />
            ) : null,
          )}
        </div>
      </form>

      <div className="flex flex-wrap items-center gap-2">
        <span className="sr-only" id="type-filter-label">
          {t.filterLabel}
        </span>
        <ul
          aria-labelledby="type-filter-label"
          className="flex flex-wrap gap-2"
        >
          {types.map((filter) => (
            <li key={filter.slug ?? "all"}>
              <Link
                href={hrefWith({ type: filter.slug })}
                scroll={false}
                prefetch={false}
                aria-current={query.type === filter.slug ? "true" : undefined}
                className={cn(chip, chipState(query.type === filter.slug))}
              >
                {filter.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <div className="flex flex-col gap-4 border-t border-line pt-5">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:gap-4">
          <span
            id="era-filter-label"
            className="w-16 shrink-0 pt-2 text-xs font-medium tracking-[0.14em] text-muted uppercase"
          >
            {t.eraLabel}
          </span>
          <ul
            aria-labelledby="era-filter-label"
            className="flex flex-wrap gap-1.5"
          >
            {eras.map((era) => (
              <li key={era.slug ?? "any"}>
                <Link
                  href={hrefWith({ era: era.slug })}
                  scroll={false}
                  prefetch={false}
                  aria-current={query.era === era.slug ? "true" : undefined}
                  className={cn(smallChip, chipState(query.era === era.slug))}
                >
                  {era.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-4">
          <span
            id="color-filter-label"
            className="w-16 shrink-0 text-xs font-medium tracking-[0.14em] text-muted uppercase"
          >
            {t.colorLabel}
          </span>
          <ul
            aria-labelledby="color-filter-label"
            className="flex flex-wrap items-center gap-2"
          >
            <li>
              <Link
                href={hrefWith({ color: null })}
                scroll={false}
                prefetch={false}
                aria-current={query.color === null ? "true" : undefined}
                className={cn(smallChip, chipState(query.color === null))}
              >
                {t.anyColor}
              </Link>
            </li>
            {COLORS.map((color) => {
              const selected = query.color === color.slug;
              return (
                <li key={color.slug}>
                  <Link
                    href={hrefWith({ color: color.slug })}
                    scroll={false}
                    prefetch={false}
                    aria-current={selected ? "true" : undefined}
                    title={dict.colors[color.slug]}
                    className={cn(
                      "group flex size-10 items-center justify-center rounded-full transition-transform duration-200 ease-gallery hover:scale-110",
                      selected &&
                        "ring-2 ring-ink ring-offset-2 ring-offset-paper",
                    )}
                  >
                    <span
                      aria-hidden="true"
                      className="size-7 rounded-full shadow-[inset_0_0_0_1px_rgb(0_0_0/0.12)]"
                      style={{ backgroundColor: color.swatch }}
                    />
                    <span className="sr-only">{dict.colors[color.slug]}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>

        {activeTags.length > 0 ? (
          <ul className="flex flex-wrap gap-2">
            {activeTags.map((tag) => {
              const label = format(t.tagFilter[tag.kind], { value: tag.value });
              return (
                <li key={tag.kind}>
                  <Link
                    href={hrefWith({ [tag.kind]: null })}
                    scroll={false}
                    prefetch={false}
                    aria-label={format(t.removeFilter, { label })}
                    className="inline-flex min-h-9 items-center gap-2 rounded-full bg-accent/10 px-3 text-[0.8125rem] text-accent-deep transition-colors duration-200 ease-gallery hover:bg-accent/20"
                  >
                    <span lang="en">{label}</span>
                    <X aria-hidden="true" className="size-3.5" />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}

        <div className="flex min-h-6 items-center gap-4">
          {hasFilters(query) ? (
            <Link
              href={searchHref(locale, {})}
              scroll={false}
              prefetch={false}
              className="text-sm text-muted underline underline-offset-4 hover:text-ink"
            >
              {t.clearFilters}
            </Link>
          ) : null}
          <p role="status" className="ml-auto text-sm text-muted">
            {isPending ? t.searching : ""}
          </p>
        </div>
      </div>
    </div>
  );
}
