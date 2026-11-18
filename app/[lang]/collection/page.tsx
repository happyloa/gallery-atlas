import type { Metadata } from "next";
import { ExhibitionsSection } from "@/components/collections/exhibitions-section";
import { FavoritesWall } from "@/components/collections/favorites-wall";
import { Container } from "@/components/ui/container";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  // Personal, browser-only content: nothing here for search engines.
  return {
    title: dict.collection.title,
    description: dict.collection.description,
    robots: { index: false },
  };
}

export default async function CollectionPage({ params }: { params: Params }) {
  const t = getDictionary(localeOf((await params).lang)).collection;
  return (
    <Container className="pt-16 pb-24 sm:pt-24 sm:pb-32">
      <h1 className="font-serif text-4xl sm:text-6xl">{t.title}</h1>
      <FavoritesWall />
      <ExhibitionsSection />
    </Container>
  );
}
