/**
 * Languages the interface is offered in. Artwork data comes from the museum's API in
 * English only; titles, artists and dates are shown as the museum publishes them.
 */

export const LOCALES = ["en", "zh-tw"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

/** Remembers a visitor's explicit language choice (set by the switcher). */
export const LOCALE_COOKIE = "ga-locale";

/** BCP 47 tags for <html lang>, hreflang and Intl formatting. */
export const LOCALE_TAGS: Record<Locale, string> = {
  en: "en",
  "zh-tw": "zh-Hant-TW",
};

/** Open Graph locale codes. */
export const OG_LOCALES: Record<Locale, string> = {
  en: "en_US",
  "zh-tw": "zh_TW",
};

export function isLocale(value: unknown): value is Locale {
  return (
    typeof value === "string" && (LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Picks a locale from an Accept-Language header. Any Chinese preference maps to the
 * Traditional Chinese interface, the only Chinese one offered.
 */
export function negotiateLocale(
  acceptLanguage: string | null | undefined,
): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE;
  const ranked = acceptLanguage
    .split(",")
    .map((part, index) => {
      const [tag, ...params] = part.trim().toLowerCase().split(";");
      const q = params.map((p) => p.trim()).find((p) => p.startsWith("q="));
      return { tag, q: q ? Number(q.slice(2)) : 1, index };
    })
    .filter((entry) => entry.tag && !Number.isNaN(entry.q) && entry.q > 0)
    .sort((a, b) => b.q - a.q || a.index - b.index);
  for (const { tag } of ranked) {
    if (tag === "zh" || tag.startsWith("zh-")) return "zh-tw";
    if (tag === "en" || tag.startsWith("en-")) return "en";
  }
  return DEFAULT_LOCALE;
}

/** Prefixes an in-site path with the locale: ("zh-tw", "/about") → "/zh-tw/about". */
export function localizePath(locale: Locale, path = "/"): string {
  if (path === "/" || path === "") return `/${locale}`;
  if (path.startsWith("/?") || path.startsWith("/#"))
    return `/${locale}${path.slice(1)}`;
  return `/${locale}${path.startsWith("/") ? path : `/${path}`}`;
}

/** Swaps the locale segment of a localized pathname. */
export function switchLocalePath(pathname: string, to: Locale): string {
  const segments = pathname.split("/");
  if (isLocale(segments[1])) segments[1] = to;
  else segments.splice(1, 0, to);
  return segments.join("/") || `/${to}`;
}
