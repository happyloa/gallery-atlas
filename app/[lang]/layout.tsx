import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader } from "next/font/google";
import { notFound } from "next/navigation";
import { DeferredStylesheet } from "@/components/layout/deferred-stylesheet";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { IntroCurtain } from "@/components/motion/intro-curtain";
import { MotionProvider } from "@/components/motion/motion-provider";
import { isLocale, LOCALE_TAGS, LOCALES, OG_LOCALES } from "@/lib/i18n/config";
import { getClientDictionary, getDictionary } from "@/lib/i18n/dictionaries";
import { I18nProvider } from "@/lib/i18n/provider";
import { siteUrl } from "@/lib/site";
import "../globals.css";

const newsreader = Newsreader({
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
  variable: "--font-newsreader",
});

const instrumentSans = Instrument_Sans({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-instrument-sans",
});

export const dynamicParams = false;

export function generateStaticParams() {
  return LOCALES.map((lang) => ({ lang }));
}

type LayoutParams = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: LayoutParams;
}): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = getDictionary(lang);
  return {
    metadataBase: siteUrl() ?? undefined,
    title: { default: "Gallery Atlas", template: "%s · Gallery Atlas" },
    description: dict.meta.description,
    openGraph: {
      siteName: "Gallery Atlas",
      locale: OG_LOCALES[lang],
      type: "website",
    },
  };
}

export const viewport: Viewport = {
  themeColor: "#1a1917",
};

/**
 * The opening curtain plays once per browser session. This runs before the first paint:
 * on a later page load in the same session it marks <html> so the curtain is never shown
 * and nothing waits for it (see app/globals.css). Without sessionStorage it plays each time.
 */
const INTRO_ONCE = `try{var s=sessionStorage;if(s.getItem("ga-intro"))document.documentElement.setAttribute("data-intro-done","true");else s.setItem("ga-intro","1")}catch(e){}`;

/**
 * Chinese text. scripts/build-fonts.mjs writes this at deploy; a page downloads only the
 * unicode-range slices for the characters it uses. The query string changes with each
 * build, so the file can be cached for a long time.
 */
const CJK_FONT_CSS = `/fonts/noto-serif-tc.css?v=${process.env.EDGE_CACHE_VERSION}`;

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: LayoutParams }>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);
  const production = process.env.NODE_ENV === "production";

  return (
    <html
      lang={LOCALE_TAGS[lang]}
      // Lets the router jump, not glide, to the top of a new page despite smooth anchors.
      data-scroll-behavior="smooth"
      className={`${newsreader.variable} ${instrumentSans.variable}`}
      // The script below may add data-intro-done before React takes over.
      suppressHydrationWarning
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: INTRO_ONCE }} />
      </head>
      <body className="flex min-h-svh flex-col">
        {/* Chinese pages are set in this face, so it loads with the page. */}
        {production && lang === "zh-tw" ? (
          <link rel="stylesheet" href={CJK_FONT_CSS} precedence="default" />
        ) : null}
        <IntroCurtain />
        <MotionProvider />
        <I18nProvider locale={lang} dict={getClientDictionary(lang)}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={lang} dict={dict} />
        </I18nProvider>
        {/* English pages only need it for the odd Chinese word (the language switch), so it
            is added after the page is interactive and never holds up rendering. */}
        {production && lang !== "zh-tw" ? (
          <DeferredStylesheet href={CJK_FONT_CSS} />
        ) : null}
      </body>
    </html>
  );
}
