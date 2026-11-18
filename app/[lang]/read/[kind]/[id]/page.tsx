import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import {
  BackLink,
  eyebrowClass,
  IndexList,
  indexLinkClass,
  RichBody,
  SourceNote,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import { getLibraryEntry, isLibraryKind } from "@/lib/artic/library";
import { parseRecordId } from "@/lib/artic/records";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string; kind: string; id: string }>;

const loadEntry = cache(async (kind: string, rawId: string) => {
  const id = parseRecordId(rawId);
  if (!isLibraryKind(kind) || id === null) return null;
  return getLibraryEntry(kind, id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, kind, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const entry = await loadEntry(kind, id).catch(() => null);
  if (!entry) return { title: dict.meta.notFoundTitle };
  const opening = entry.body[0]?.paragraphs[0]
    ?.map((run) => run.text)
    .join("")
    .slice(0, 180);
  return {
    title: entry.title,
    description: opening,
    alternates: languageAlternates(locale, `/read/${kind}/${id}`),
  };
}

export default async function LibraryEntryPage({ params }: { params: Params }) {
  const { lang, kind, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.read;
  const entry = await loadEntry(kind, id);
  if (!entry) notFound();

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink
          href={localizePath(locale, `/read/${entry.kind}`)}
          label={t.kinds[entry.kind]}
        />
      </Container>

      <Container className="mt-8">
        <header className="max-w-4xl animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className={eyebrowClass}>{t.kinds[entry.kind]}</p>
          <h1
            lang="en"
            className="mt-5 font-serif text-4xl leading-[1.08] tracking-tight text-balance sm:text-6xl"
          >
            {entry.title}
          </h1>
          {entry.author ? (
            <p lang="en" className="mt-5 text-lg text-muted">
              {format(t.by, { author: entry.author })}
            </p>
          ) : null}
          {entry.parent ? (
            <p className="mt-5 text-sm text-muted">
              {t.partOf}{" "}
              <Link
                href={localizePath(
                  locale,
                  `/read/${entry.parent.kind}/${entry.parent.id}`,
                )}
                lang="en"
                className="text-ink underline decoration-ink/30 underline-offset-4 hover:decoration-ink"
              >
                {entry.parent.title}
              </Link>
            </p>
          ) : null}
          {entry.artworkId ? (
            <Link
              href={localizePath(locale, `/artworks/${entry.artworkId}`)}
              className="group mt-5 inline-flex min-h-11 items-center gap-2 text-sm underline-offset-4 hover:underline"
            >
              {t.viewArtwork}
              <ArrowRight
                aria-hidden="true"
                className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
              />
            </Link>
          ) : null}
        </header>
      </Container>

      <Container className="mt-12 sm:mt-16">
        {entry.body.length > 0 ? <RichBody sections={entry.body} /> : null}
        {entry.body.length === 0 && entry.contents.length === 0 ? (
          <p className="text-muted">{t.fullTextElsewhere}</p>
        ) : null}

        {entry.contents.length > 0 ? (
          <section
            aria-labelledby="contents"
            className={entry.body.length > 0 ? "mt-16 max-w-3xl" : "max-w-3xl"}
          >
            <h2 id="contents" className={eyebrowClass}>
              {t.contents}
            </h2>
            <div className="mt-5">
              <IndexList>
                {entry.contents.map((item) => (
                  <li key={item.id}>
                    <Link
                      href={localizePath(
                        locale,
                        `/read/${item.kind}/${item.id}`,
                      )}
                      prefetch={false}
                      className={indexLinkClass}
                    >
                      <span
                        lang="en"
                        className="font-serif text-xl leading-snug group-hover:underline group-hover:underline-offset-4"
                      >
                        {item.title}
                      </span>
                      <ArrowRight
                        aria-hidden="true"
                        className="size-4 shrink-0"
                      />
                    </Link>
                  </li>
                ))}
              </IndexList>
            </div>
          </section>
        ) : null}

        <SourceNote
          credit={t.credit}
          href={entry.sourceUrl}
          label={t.readAtMuseum}
          dict={dict}
        />
      </Container>
    </article>
  );
}
