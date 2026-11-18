/** Small helpers shared by the index and detail pages. */
import { isStableFailure } from "@/lib/artic/client";
import { describeFailure } from "@/lib/artic/error-reason";
import { normalizeKeyword } from "@/lib/artic/queries";
import { MAX_LIST_PAGE } from "@/lib/artic/records";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { reportUpstreamFailure } from "@/lib/render-health";

export type RouteSearchParams = Record<string, string | string[] | undefined>;

export const localeOf = (lang: string): Locale =>
  isLocale(lang) ? lang : "en";

export function stringParam(
  params: RouteSearchParams,
  key: string,
): string | undefined {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

export const keywordParam = (params: RouteSearchParams): string =>
  normalizeKeyword(stringParam(params, "q"));

/**
 * A page number from the URL. Anything that is not a number means the first page. A number
 * past `max` is null: there is no such page, and the caller answers 404 without asking the
 * museum's API, which refuses pages beyond its 1,000-result window with an error.
 *
 * `max` defaults to the last index page inside that window. Pass the list's own last page
 * when its page size is different.
 */
export function pageParam(
  params: RouteSearchParams,
  max: number = MAX_LIST_PAGE,
): number | null {
  const raw = stringParam(params, "page");
  if (!raw || !/^\d+$/.test(raw)) return 1;
  // However long the digits run, the number is only compared, never sent anywhere.
  const page = Math.max(1, Number(raw));
  return page > max ? null : page;
}

type QueryValues = Record<string, string | number | null | undefined>;

/** `base` with the given query values, leaving out empty ones and page 1. */
export function withQuery(base: string, values: QueryValues): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/**
 * `alternates` for a page that exists in every language: its own canonical address, the
 * same page in each language, and `x-default`, the address without a language, which sends
 * a visitor to theirs.
 *
 * `query` is what selects this page among others at the same path, such as `page` on a
 * paged list. Each address carries it, so page 3 points at page 3 in the other language
 * and is not passed off as a copy of page 1.
 */
export function languageAlternates(
  locale: Locale,
  path: string,
  query: QueryValues = {},
) {
  const address = (base: string) => withQuery(base, query);
  return {
    canonical: address(localizePath(locale, path)),
    languages: {
      ...Object.fromEntries(
        LOCALES.map((l) => [LOCALE_TAGS[l], address(localizePath(l, path))]),
      ),
      "x-default": address(path),
    },
  };
}

export type Attempt<T> =
  | { data: T; failure: null }
  | { data: null; failure: ReturnType<typeof describeFailure> };

/**
 * Runs a museum read, turning a failure into something the page can show. Unless the
 * failure is one that would come back the same next time, the page is also marked as
 * incomplete, so the Worker does not keep a copy of the error.
 */
export async function attempt<T>(load: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { data: await load(), failure: null };
  } catch (caught) {
    if (!isStableFailure(caught)) reportUpstreamFailure();
    return { data: null, failure: describeFailure(caught) };
  }
}
