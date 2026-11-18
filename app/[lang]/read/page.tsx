import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import { eyebrowClass, OutLink, PageHeader } from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { getLibraryOverview, LIBRARY_KINDS } from "@/lib/artic/library";
import { LOCALE_TAGS, localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { attempt, languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  return {
    title: dict.read.heading,
    description: dict.read.metaDescription,
    alternates: languageAlternates(locale, "/read"),
  };
}

export default async function ReadPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.read;
  const result = await attempt(getLibraryOverview);
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
      </Container>

      <Container className="mt-14">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        <ul className="grid border-t border-line sm:grid-cols-2 sm:gap-x-12 lg:grid-cols-3">
          {LIBRARY_KINDS.map((kind, index) => {
            const count = result.data?.counts[kind];
            return (
              <Reveal
                as="li"
                key={kind}
                delay={(index % 3) * 70}
                className="border-b border-line"
              >
                <Link
                  href={localizePath(locale, `/read/${kind}`)}
                  className="group flex min-h-28 items-end justify-between gap-4 py-6"
                >
                  <span className="font-serif text-3xl leading-tight underline-offset-4 group-hover:underline">
                    {t.kinds[kind]}
                  </span>
                  {count !== undefined ? (
                    <span className="text-sm text-muted tabular-nums">
                      {number.format(count)}
                    </span>
                  ) : null}
                </Link>
              </Reveal>
            );
          })}
        </ul>

        {result.data?.sections.length ? (
          <section aria-labelledby="museum-sections" className="mt-20">
            <h2 id="museum-sections" className={eyebrowClass}>
              {t.onMuseumSite}
            </h2>
            <ul className="mt-5 flex flex-wrap gap-x-8 gap-y-3">
              {result.data.sections.map((section) => (
                <li key={section.id} lang="en">
                  <OutLink href={section.url} dict={dict}>
                    {section.title}
                  </OutLink>
                </li>
              ))}
            </ul>
          </section>
        ) : null}
        <p className="mt-16 text-xs text-muted">{t.credit}</p>
      </Container>
    </div>
  );
}
