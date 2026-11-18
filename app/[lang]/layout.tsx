import type { Metadata, Viewport } from "next";
import { Instrument_Sans, Newsreader, Noto_Serif_TC } from "next/font/google";
import { notFound } from "next/navigation";
import { SiteFooter } from "@/components/layout/site-footer";
import { SiteHeader } from "@/components/layout/site-header";
import { isLocale, LOCALE_TAGS, LOCALES, OG_LOCALES } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
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

/**
 * Chinese text. Google splits CJK fonts into unicode-range slices, so a page downloads
 * only the slices for characters it actually uses. Not preloaded for the same reason.
 */
const notoSerifTc = Noto_Serif_TC({
  weight: ["400", "500", "600"],
  display: "swap",
  preload: false,
  variable: "--font-noto-serif-tc",
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

export default async function LocaleLayout({
  children,
  params,
}: Readonly<{ children: React.ReactNode; params: LayoutParams }>) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = getDictionary(lang);

  return (
    <html
      lang={LOCALE_TAGS[lang]}
      className={`${newsreader.variable} ${instrumentSans.variable} ${notoSerifTc.variable}`}
    >
      <body className="flex min-h-svh flex-col">
        <I18nProvider locale={lang} dict={dict}>
          <SiteHeader />
          <main id="main" className="flex-1">
            {children}
          </main>
          <SiteFooter locale={lang} dict={dict} />
        </I18nProvider>
      </body>
    </html>
  );
}
