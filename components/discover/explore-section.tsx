import { ChevronLeft, ChevronRight, Search } from "@/components/ui/icons";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { Button } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { TextField } from "@/components/ui/text-field";
import type { Artwork } from "@/lib/artwork/types";
import { cn } from "@/lib/utils";

const TYPE_FILTERS = ["All", "Painting", "Print"] as const;

export interface ExploreSectionProps {
  artworks: readonly Artwork[];
  /** Shown above the grid while the page renders the preview snapshot instead of live data. */
  previewNotice?: string;
}

/**
 * Static layout of the Explore area. Search, filters and paging are rendered but disabled
 * until the live API integration; they must not pretend to work on snapshot data.
 */
export function ExploreSection({
  artworks,
  previewNotice,
}: ExploreSectionProps) {
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

          <form
            role="search"
            aria-label="Search artworks"
            className="flex flex-col gap-6"
            action="/"
          >
            <div className="flex items-end gap-3">
              <TextField
                className="flex-1"
                label="Search artworks"
                hideLabel
                name="q"
                type="search"
                placeholder="Search by artist, title or subject"
                icon={<Search className="size-5" />}
                disabled
                hint="Search opens when the live collection is connected."
              />
            </div>
            <fieldset disabled className="flex flex-wrap items-center gap-2">
              <legend className="sr-only">Filter by type</legend>
              {TYPE_FILTERS.map((type) => {
                const selected = type === "All";
                return (
                  <button
                    key={type}
                    type="button"
                    aria-pressed={selected}
                    className={cn(
                      "min-h-10 rounded-full border px-4 text-sm transition-colors duration-200 ease-gallery disabled:cursor-not-allowed",
                      selected
                        ? "border-ink bg-ink text-paper"
                        : "border-ink/25 text-ink disabled:opacity-60",
                    )}
                  >
                    {type}
                  </button>
                );
              })}
            </fieldset>
          </form>
        </div>

        <div className="mt-14 flex flex-col gap-3 border-y border-line py-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p aria-live="polite">
            <span className="font-medium">{artworks.length}</span> works
          </p>
          {previewNotice ? <p className="text-muted">{previewNotice}</p> : null}
        </div>

        <ul className="mt-14 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {artworks.map((artwork) => (
            <li key={artwork.id}>
              <ArtworkCard artwork={artwork} />
            </li>
          ))}
        </ul>

        <nav
          aria-label="Pagination"
          className="mt-20 flex items-center justify-between border-t border-line pt-6"
        >
          <Button variant="secondary" size="sm" disabled>
            <ChevronLeft aria-hidden="true" className="size-4" />
            Previous
          </Button>
          <p className="text-sm text-muted">Page 1</p>
          <Button variant="secondary" size="sm" disabled>
            Next
            <ChevronRight aria-hidden="true" className="size-4" />
          </Button>
        </nav>
      </Container>
    </section>
  );
}
