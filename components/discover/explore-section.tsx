import { Suspense } from "react";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import type { SearchQueryError } from "@/lib/artic/queries";
import { toSearchParams } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { ExploreControls } from "./explore-controls";
import { ExploreResults } from "./explore-results";
import { ResultsSkeleton } from "./results-skeleton";

export interface ExploreSectionProps {
  locale: Locale;
  dict: Dictionary;
  query: SearchQuery;
  error?: SearchQueryError;
}

/** Search, type filters and the results wall. The URL holds all of its state. */
export function ExploreSection({
  locale,
  dict,
  query,
  error,
}: ExploreSectionProps) {
  // A new key per search shows the skeleton while that search loads, instead of
  // leaving the previous results on screen.
  const resultsKey = `${toSearchParams(query).toString()}|${error?.code ?? ""}`;

  return (
    <section
      id="explore"
      aria-labelledby="explore-heading"
      className="scroll-mt-16 bg-paper py-20 sm:py-28"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-end lg:gap-16">
          <Reveal>
            <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
              {dict.explore.eyebrow}
            </p>
            <h2
              id="explore-heading"
              className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              {dict.explore.heading}
            </h2>
          </Reveal>
          <Reveal delay={120}>
            <ExploreControls query={query} />
          </Reveal>
        </div>

        <Suspense
          key={resultsKey}
          fallback={<ResultsSkeleton label={dict.explore.loading} />}
        >
          <ExploreResults
            locale={locale}
            dict={dict}
            query={query}
            error={error}
          />
        </Suspense>
      </Container>
    </section>
  );
}
