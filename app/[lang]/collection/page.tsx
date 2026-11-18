import type { Metadata } from "next";
import Link from "next/link";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { isLocale, localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";

type Params = Promise<{ lang: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.collection.title,
    description: dict.collection.description,
    robots: { index: false },
  };
}

export default async function CollectionPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const t = getDictionary(locale).collection;
  return (
    <Container className="pt-16 sm:pt-24">
      <h1 className="font-serif text-4xl sm:text-6xl">{t.title}</h1>
      <EmptyState
        title={t.emptyTitle}
        action={
          <Link
            href={`${localizePath(locale, "/")}#explore`}
            className={buttonStyles()}
          >
            {t.explore}
          </Link>
        }
      >
        <p>{t.emptyBody}</p>
      </EmptyState>
    </Container>
  );
}
