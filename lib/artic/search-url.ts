/**
 * The Explore URL shape, shared by server and client code. Kept free of Zod and upstream
 * details so client components can import it without pulling either into the bundle.
 */
import type { Locale } from "@/lib/i18n/config";
import type { ArtworkTypeSlug, ColorSlug, EraSlug } from "./config";

export interface SearchQuery {
  q: string;
  type: ArtworkTypeSlug | null;
  era: EraSlug | null;
  color: ColorSlug | null;
  /** Exact style, subject or theme tag from the museum's records. */
  style: string | null;
  subject: string | null;
  theme: string | null;
  page: number;
}

/** A query with nothing set: every work, first page. */
export const EMPTY_QUERY: SearchQuery = {
  q: "",
  type: null,
  era: null,
  color: null,
  style: null,
  subject: null,
  theme: null,
  page: 1,
};

/** The URL parameters that narrow a search, in the order they appear in links. */
export const FILTER_KEYS = [
  "type",
  "era",
  "color",
  "style",
  "subject",
  "theme",
] as const;

export type FilterKey = (typeof FILTER_KEYS)[number];

/** Query string for links within the site. Defaults are omitted to keep URLs short. */
export function toSearchParams(query: Partial<SearchQuery>): URLSearchParams {
  const params = new URLSearchParams();
  if (query.q) params.set("q", query.q);
  for (const key of FILTER_KEYS) {
    const value = query[key];
    if (value) params.set(key, value);
  }
  if (query.page && query.page > 1) params.set("page", String(query.page));
  return params;
}

/** True when anything narrows the search beyond "all works". */
export function hasFilters(query: Partial<SearchQuery>): boolean {
  return Boolean(query.q) || FILTER_KEYS.some((key) => Boolean(query[key]));
}

/** A link to Explore in `locale` with these settings, landing on the results. */
export function searchHref(
  locale: Locale,
  query: Partial<SearchQuery>,
  hash = "explore",
): string {
  const search = toSearchParams(query).toString();
  return `/${locale}${search ? `?${search}` : ""}${hash ? `#${hash}` : ""}`;
}
