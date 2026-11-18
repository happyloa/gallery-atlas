/** Small helpers shared by the index and detail pages. */
import { describeFailure } from "@/lib/artic/error-reason";
import { normalizeKeyword } from "@/lib/artic/queries";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";

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

/** A page number from the URL. Anything unusable means the first page. */
export function pageParam(params: RouteSearchParams): number {
  const raw = stringParam(params, "page");
  if (!raw || !/^\d{1,4}$/.test(raw)) return 1;
  return Math.max(1, Number(raw));
}

/** `base` with the given query values, leaving out empty ones and page 1. */
export function withQuery(
  base: string,
  values: Record<string, string | number | null | undefined>,
): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value === null || value === undefined || value === "") continue;
    if (key === "page" && Number(value) <= 1) continue;
    query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `${base}?${text}` : base;
}

/** `alternates.languages` for a path that exists in every language. */
export const languageAlternates = (path: string) => ({
  languages: Object.fromEntries(
    LOCALES.map((locale) => [LOCALE_TAGS[locale], localizePath(locale, path)]),
  ),
});

export type Attempt<T> =
  | { data: T; failure: null }
  | { data: null; failure: ReturnType<typeof describeFailure> };

/** Runs a museum read, turning a failure into something the page can show. */
export async function attempt<T>(load: () => Promise<T>): Promise<Attempt<T>> {
  try {
    return { data: await load(), failure: null };
  } catch (caught) {
    return { data: null, failure: describeFailure(caught) };
  }
}
