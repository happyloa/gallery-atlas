import { Suspense } from "react";
import { Container } from "@/components/ui/container";
import type { SearchQueryError } from "@/lib/artic/queries";
import { toSearchParams } from "@/lib/artic/search-url";
import type { SearchQuery } from "@/lib/artic/search-url";
import { ExploreControls } from "./explore-controls";
import { ExploreResults } from "./explore-results";
import { ResultsSkeleton } from "./results-skeleton";

export interface ExploreSectionProps {
  query: SearchQuery;
  error?: SearchQueryError;
}

/** Search, type filters and the results wall. The URL holds all of its state. */
export function ExploreSection({ query, error }: ExploreSectionProps) {
  // A new key per search shows the skeleton while that search loads, instead of
  // leaving the previous results on screen.
  const resultsKey = `${toSearchParams(query).toString()}|${error?.code ?? ""}`;

  return (
    <section
      id="explore"
      aria-labelledby="explore-heading"
      className="scroll-mt-6 bg-paper py-20 sm:py-28"
    >
      <Container>
        <div className="grid gap-10 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] lg:items-end lg:gap-16">
          <div>
            <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
              The collection
            </p>
            <h2
              id="explore-heading"
              className="mt-4 font-serif text-4xl leading-[1.05] sm:text-5xl lg:text-6xl"
            >
              Explore the collection
            </h2>
          </div>
          <ExploreControls query={query} />
        </div>

        <Suspense key={resultsKey} fallback={<ResultsSkeleton />}>
          <ExploreResults query={query} error={error} />
        </Suspense>
      </Container>
    </section>
  );
}
