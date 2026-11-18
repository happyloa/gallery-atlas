import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { ZoomDialog } from "@/components/artwork/zoom-dialog";
import { FavoriteButton } from "@/components/collections/favorite-button";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { EmptyState } from "@/components/ui/empty-state";
import { ArrowLeft, ArrowUpRight } from "@/components/ui/icons";
import { getArtworkDetail } from "@/lib/artic/artworks";
import { museumArtworkUrl } from "@/lib/artic/config";
import { parseArtworkId } from "@/lib/artic/queries";
import type { ArtworkDetail } from "@/lib/artwork/types";
import {
  isLocale,
  LOCALE_TAGS,
  LOCALES,
  localizePath,
} from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { EXTERNAL_REL } from "@/lib/utils";

type Params = Promise<{ lang: string; id: string }>;

const localeOf = (lang: string): Locale => (isLocale(lang) ? lang : "en");

/** One upstream read shared by generateMetadata and the page. */
const loadArtwork = cache(async (rawId: string) => {
  const id = parseArtworkId(rawId);
  if (id === null)
    return { id: null, lookup: { status: "not_found" as const } };
  return { id, lookup: await getArtworkDetail(id) };
});

function summary(artwork: ArtworkDetail): string {
  const first = artwork.description?.[0]?.map((run) => run.text).join("") ?? "";
  const base =
    first ||
    [
      `${artwork.title} by ${artwork.artist}`,
      artwork.dateDisplay,
      artwork.medium,
    ]
      .filter(Boolean)
      .join(", ");
  return base.length > 180 ? `${base.slice(0, 177).trimEnd()}…` : base;
}

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id: rawId } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const { id, lookup } = await loadArtwork(rawId);
  if (lookup.status === "not_found")
    return { title: dict.meta.notFoundTitle, robots: { index: false } };
  if (lookup.status === "restricted")
    return { title: dict.detail.restrictedTitle, robots: { index: false } };

  const artwork = lookup.artwork;
  const title = `${artwork.title} · ${artwork.artist}`;
  const description = summary(artwork);
  return {
    title,
    description,
    alternates: {
      languages: Object.fromEntries(
        LOCALES.map((l) => [
          LOCALE_TAGS[l],
          localizePath(l, `/artworks/${id}`),
        ]),
      ),
    },
    openGraph: {
      title,
      description,
      type: "article",
      images: [
        {
          url: artwork.image.src,
          width: 843,
          height: Math.round(843 / artwork.image.aspectRatio),
          alt: artwork.image.alt,
        },
      ],
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
      images: [artwork.image.src],
    },
  };
}

function Fact({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="grid grid-cols-[8rem_minmax(0,1fr)] gap-4 border-t border-line py-3 text-sm sm:grid-cols-[9rem_minmax(0,1fr)]">
      <dt className="text-muted">{label}</dt>
      <dd lang="en" className="min-w-0 break-words text-ink">
        {value}
      </dd>
    </div>
  );
}

function Restricted({
  id,
  locale,
  dict,
}: {
  id: number | null;
  locale: Locale;
  dict: Dictionary;
}) {
  return (
    <EmptyState
      headingLevel="h1"
      eyebrow={dict.detail.restrictedEyebrow}
      title={dict.detail.restrictedTitle}
      action={
        <>
          <Link href={localizePath(locale, "/")} className={buttonStyles()}>
            {dict.detail.back}
          </Link>
          {id !== null ? (
            <a
              href={museumArtworkUrl(id)}
              target="_blank"
              rel={EXTERNAL_REL}
              className={buttonStyles({ variant: "secondary" })}
            >
              {dict.detail.viewAtMuseum}
              <ArrowUpRight className="size-4" />
              <span className="sr-only">{dict.site.opensInNewTab}</span>
            </a>
          ) : null}
        </>
      }
    >
      <p>{dict.detail.restrictedBody}</p>
    </EmptyState>
  );
}

export default async function ArtworkPage({ params }: { params: Params }) {
  const { lang, id: rawId } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.detail;
  const { id, lookup } = await loadArtwork(rawId);

  if (lookup.status === "not_found") notFound();
  if (lookup.status === "restricted")
    return <Restricted id={id} locale={locale} dict={dict} />;

  const artwork = lookup.artwork;

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <Link
          href={`${localizePath(locale, "/")}#explore`}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t.back}
        </Link>
      </Container>

      <Container className="mt-6 grid gap-12 lg:mt-10 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)] lg:gap-16">
        {/* The work on its own wall. */}
        <div>
          <div className="flex min-h-[50svh] items-center justify-center bg-paper-deep px-6 py-10 sm:px-12 sm:py-16 lg:min-h-[70svh]">
            <ArtworkImage
              image={artwork.image}
              sizes="(min-width: 1024px) 55vw, 92vw"
              priority
              className="h-auto max-h-[70svh] w-auto max-w-full shadow-[0_30px_50px_-28px_rgb(34_33_31/0.6)]"
              fallbackClassName="w-full max-w-xl"
            />
          </div>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-muted">{t.imageCredit}</p>
            {artwork.zoomSrc ? (
              <ZoomDialog
                src={artwork.zoomSrc}
                alt={artwork.image.alt}
                title={artwork.title}
                aspectRatio={artwork.image.aspectRatio}
              />
            ) : null}
          </div>
        </div>

        <div className="lg:pt-6">
          <h1
            lang="en"
            className="font-serif text-4xl leading-[1.08] text-balance italic sm:text-5xl"
          >
            {artwork.title}
          </h1>
          <p lang="en" className="mt-4 text-lg whitespace-pre-line text-ink/90">
            {artwork.artistDisplay ?? artwork.artist}
          </p>
          {artwork.dateDisplay ? (
            <p lang="en" className="mt-1 text-muted">
              {artwork.dateDisplay}
            </p>
          ) : null}

          <div className="mt-8 flex flex-wrap items-start gap-3">
            <FavoriteButton
              artworkId={artwork.id}
              title={artwork.title}
              variant="full"
            />
            <a
              href={artwork.sourceUrl}
              target="_blank"
              rel={EXTERNAL_REL}
              className={buttonStyles({ variant: "quiet", size: "md" })}
            >
              {t.viewAtMuseum}
              <ArrowUpRight className="size-4" />
              <span className="sr-only">{dict.site.opensInNewTab}</span>
            </a>
          </div>

          <dl className="mt-10 border-b border-line">
            <Fact label={t.artist} value={artwork.artist} />
            <Fact label={t.date} value={artwork.dateDisplay} />
            <Fact label={t.type} value={artwork.type} />
            <Fact label={t.medium} value={artwork.medium} />
            <Fact label={t.dimensions} value={artwork.dimensions} />
            <Fact label={t.origin} value={artwork.origin} />
            <Fact label={t.creditLine} value={artwork.creditLine} />
          </dl>
        </div>
      </Container>

      {artwork.description ? (
        <Container className="mt-16 sm:mt-24">
          <section
            aria-labelledby="about-work"
            className="grid gap-6 border-t border-line pt-10 md:grid-cols-[minmax(0,14rem)_minmax(0,1fr)] md:gap-12"
          >
            <h2
              id="about-work"
              className="text-xs font-medium tracking-[0.18em] text-accent uppercase md:pt-2"
            >
              {t.aboutWork}
            </h2>
            <div className="max-w-2xl">
              <div
                lang="en"
                className="space-y-4 font-serif text-lg leading-8 text-ink/90 sm:text-xl sm:leading-9"
              >
                {artwork.description.map((paragraph, index) => (
                  <p key={index}>
                    {paragraph.map((run, runIndex) =>
                      run.italic ? (
                        <em key={runIndex}>{run.text}</em>
                      ) : (
                        run.text
                      ),
                    )}
                  </p>
                ))}
              </div>
              <p className="mt-6 text-xs text-muted">{t.descriptionCredit}</p>
            </div>
          </section>
        </Container>
      ) : null}
    </article>
  );
}
