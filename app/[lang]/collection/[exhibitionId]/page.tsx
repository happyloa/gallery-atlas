import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ExhibitionView } from "@/components/collections/exhibition-view";
import { Container } from "@/components/ui/container";
import { isLocale } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Params = Promise<{ lang: string; exhibitionId: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

/** Exhibition ids are generated in the browser (UUIDs); anything else cannot exist. */
const EXHIBITION_ID = /^[A-Za-z0-9-]{1,64}$/;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  // The exhibition lives in the visitor's browser; the server only knows its id.
  return { title: dict.exhibitions.pageTitle, robots: { index: false } };
}

export default async function ExhibitionPage({ params }: { params: Params }) {
  const { exhibitionId } = await params;
  if (!EXHIBITION_ID.test(exhibitionId)) notFound();
  return (
    <Container className="pt-8 pb-24 sm:pt-10 sm:pb-32">
      <ExhibitionView id={exhibitionId} />
    </Container>
  );
}
