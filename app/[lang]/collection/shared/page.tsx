import type { Metadata } from "next";
import { ArtworkWall } from "@/components/artwork/artwork-wall";
import { SaveShared } from "@/components/collections/save-shared";
import { ResultsError } from "@/components/discover/results-error";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { getArtworksByIds } from "@/lib/artic/artworks";
import { describeFailure } from "@/lib/artic/error-reason";
import { parseSharedExhibition } from "@/lib/collections/share";
import { isLocale } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";

type Params = Promise<{ lang: string }>;
type SearchParams = Promise<Record<string, string | string[] | undefined>>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  // Each link is one person's selection: not something for search engines.
  return { title: dict.share.metaTitle, robots: { index: false } };
}

export default async function SharedExhibitionPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.share;
  const shared = parseSharedExhibition(await searchParams);

  if (!shared) {
    return (
      <Container className="py-16 sm:py-24">
        <EmptyState headingLevel="h1" title={t.invalidTitle}>
        </EmptyState>
      </Container>
    );
  }

  let read: Awaited<ReturnType<typeof getArtworksByIds>> | null = null;
  let failure: ReturnType<typeof describeFailure> | null = null;
  try {
    read = await getArtworksByIds(shared.ids);
  } catch (caught) {
    failure = describeFailure(caught);
  }

  return (
    <Container className="pt-14 pb-24 sm:pt-20 sm:pb-32">
      <header className="flex flex-col gap-8 border-b border-line pb-10 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1 className="mt-4 font-serif text-4xl break-words sm:text-6xl">{shared.title}</h1>
          {read && read.unavailable.length > 0 ? (
            <p className="mt-3 text-sm text-muted">
              {format(t.missing, { count: read.unavailable.length })}
            </p>
          ) : null}
        </div>
        <SaveShared title={shared.title} artworkIds={shared.ids} />
      </header>
      {failure ? <ResultsError {...failure} /> : null}
      {read ? (
        <ArtworkWall artworks={read.artworks} locale={locale} className="mt-12" />
      ) : null}
    </Container>
  );
}
