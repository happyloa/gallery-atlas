import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { absoluteUrl, siteUrl } from "@/lib/site";

/**
 * What crawlers are asked to leave alone, per language:
 * - saved works and exhibitions, which live in each visitor's browser;
 * - the random work, which leads somewhere new on every request;
 * - site search, and Explore with anything in its query string. Every keyword, filter,
 *   order and page number is a link, so together they are tens of thousands of addresses
 *   for the same works, and each one costs a render and a request to the museum.
 * The plain pages stay open, paged lists such as /artists?page=2 included.
 */
const PER_LANGUAGE = ["/collection", "/random", "/search", "?"];

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // The API is for the site itself.
      disallow: [
        "/api/",
        ...PER_LANGUAGE.flatMap((path) =>
          LOCALES.map((locale) => `/${locale}${path}`),
        ),
      ],
    },
    ...(siteUrl()
      ? { sitemap: absoluteUrl("/sitemap.xml"), host: siteUrl()?.origin }
      : {}),
  };
}
