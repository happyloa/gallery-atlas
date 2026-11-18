import type { MetadataRoute } from "next";
import { FEATURED_ARTWORK_IDS } from "@/lib/artic/featured";
import { LOCALE_TAGS, LOCALES, localizePath } from "@/lib/i18n/config";
import { absoluteUrl } from "@/lib/site";

/**
 * The pages worth indexing, in both languages: home, About, and the works hung in the
 * homepage room. The full collection is reachable through search and is not listed here.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/about",
    "/exhibitions",
    "/galleries",
    "/tours",
    "/map",
    "/artists",
    "/browse",
    "/read",
    "/events",
    "/visit",
    "/shop",
    "/media",
    ...FEATURED_ARTWORK_IDS.map((id) => `/artworks/${id}`),
  ];
  return paths.flatMap((path) =>
    LOCALES.map((locale) => ({
      url: absoluteUrl(localizePath(locale, path)),
      changeFrequency: path === "/" ? ("daily" as const) : ("monthly" as const),
      priority: path === "/" ? 1 : 0.6,
      alternates: {
        languages: Object.fromEntries(
          LOCALES.map((l) => [
            LOCALE_TAGS[l],
            absoluteUrl(localizePath(l, path)),
          ]),
        ),
      },
    })),
  );
}
