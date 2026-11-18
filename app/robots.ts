import type { MetadataRoute } from "next";
import { LOCALES } from "@/lib/i18n/config";
import { absoluteUrl, siteUrl } from "@/lib/site";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      // Saved works and exhibitions live in each visitor's browser; the API is for the site.
      disallow: ["/api/", ...LOCALES.map((locale) => `/${locale}/collection`)],
    },
    ...(siteUrl()
      ? { sitemap: absoluteUrl("/sitemap.xml"), host: siteUrl()?.origin }
      : {}),
  };
}
