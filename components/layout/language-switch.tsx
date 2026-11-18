"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import {
  LOCALE_COOKIE,
  LOCALE_TAGS,
  switchLocalePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

const ONE_YEAR = 60 * 60 * 24 * 365;

function SwitchLink({ query, overHero }: { query: string; overHero: boolean }) {
  const { locale, dict } = useI18n();
  const pathname = usePathname();
  const otherLocale: Locale = locale === "en" ? "zh-tw" : "en";
  const href = `${switchLocalePath(pathname, otherLocale)}${query ? `?${query}` : ""}`;

  return (
    <Link
      href={href}
      onClick={() => {
        // Remember the choice for URLs without a language prefix (see proxy.ts).
        document.cookie = `${LOCALE_COOKIE}=${otherLocale}; path=/; max-age=${ONE_YEAR}; samesite=lax`;
      }}
      hrefLang={LOCALE_TAGS[otherLocale]}
      className={cn(
        "inline-flex min-h-11 items-center rounded-full border px-3.5 text-[0.8125rem] transition-colors duration-200 ease-gallery",
        overHero
          ? "border-gallery-text/35 hover:border-gallery-text"
          : "border-ink/25 hover:border-ink",
      )}
    >
      {/* The visible label stays the start of the accessible name (WCAG 2.5.3). */}
      <span lang={LOCALE_TAGS[otherLocale]}>{dict.site.switchLanguage}</span>
      <span className="sr-only">: {dict.site.switchLanguageLabel}</span>
    </Link>
  );
}

function SwitchLinkWithQuery({ overHero }: { overHero: boolean }) {
  return (
    <SwitchLink query={useSearchParams().toString()} overHero={overHero} />
  );
}

/**
 * Link to the same page in the other language, keeping the search. Reading the query string
 * needs a Suspense boundary, or static pages (About, My Collection) fail to prerender; the
 * fallback is the same link without the query.
 */
export function LanguageSwitch({ overHero }: { overHero: boolean }) {
  return (
    <Suspense fallback={<SwitchLink query="" overHero={overHero} />}>
      <SwitchLinkWithQuery overHero={overHero} />
    </Suspense>
  );
}
