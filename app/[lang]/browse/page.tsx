import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import { PageHeader } from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { getBrowseOverview, WORK_FACETS } from "@/lib/artic/directory";
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
    title: dict.browse.heading,
    description: dict.browse.metaDescription,
    alternates: languageAlternates(locale, "/browse"),
  };
}

export default async function BrowsePage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.browse;
  const result = await attempt(getBrowseOverview);
  const number = new Intl.NumberFormat(LOCALE_TAGS[locale]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading} />
      </Container>

      <Container className="mt-14">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {result.data ? (
          <div className="grid gap-x-12 gap-y-16 sm:grid-cols-2 lg:grid-cols-3">
            {WORK_FACETS.map((facet, index) => {
              const terms = result.data.samples[facet] ?? [];
              const facetPath = `/browse/${facet}`;
              return (
                <Reveal
                  as="section"
                  key={facet}
                  delay={(index % 3) * 80}
                  aria-labelledby={`facet-${facet}`}
                >
                  <h2
                    id={`facet-${facet}`}
                    className="border-b border-line pb-3 font-serif text-3xl"
                  >
                    <Link
                      href={localizePath(locale, facetPath)}
                      className="underline-offset-4 hover:underline"
                    >
                      {t.facets[facet]}
                    </Link>
                  </h2>
                  <ul className="mt-3">
                    {terms.map((term) => (
                      <li key={term.id}>
                        <Link
                          href={localizePath(locale, `${facetPath}/${term.id}`)}
                          prefetch={false}
                          className="flex min-h-10 items-baseline justify-between gap-4 py-1.5 text-sm underline-offset-4 hover:underline"
                        >
                          <span lang="en">{term.title}</span>
                          {term.works !== null ? (
                            <span className="text-muted tabular-nums">
                              {number.format(term.works)}
                            </span>
                          ) : null}
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={localizePath(locale, facetPath)}
                    aria-label={`${t.viewAll}: ${t.facets[facet]}`}
                    className="group mt-3 inline-flex min-h-10 items-center gap-2 text-sm text-accent-deep underline-offset-4 hover:underline"
                  >
                    {t.viewAll}
                    <ArrowRight
                      aria-hidden="true"
                      className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
                    />
                  </Link>
                </Reveal>
              );
            })}
          </div>
        ) : null}

        <div className="mt-20 grid gap-6 border-t border-line pt-10 sm:grid-cols-2">
          {(["places", "vocabulary"] as const).map((facet) => (
            <Link
              key={facet}
              href={localizePath(locale, `/browse/${facet}`)}
              className="group flex items-center justify-between gap-4 py-2"
            >
              <span className="font-serif text-3xl underline-offset-4 group-hover:underline">
                {t.facets[facet]}
              </span>
              <ArrowRight
                aria-hidden="true"
                className="size-5 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
              />
            </Link>
          ))}
        </div>
      </Container>
    </div>
  );
}
