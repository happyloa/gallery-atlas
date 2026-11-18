import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { cache } from "react";
import { TourPlayer } from "@/components/tours/tour-player";
import { Credit, MUSEUM_SITE } from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { ArrowLeft } from "@/components/ui/icons";
import { parseId } from "@/lib/artic/queries";
import { getTour } from "@/lib/artic/tours";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string; id: string }>;

const loadTour = cache(async (rawId: string) => {
  const id = parseId(rawId);
  if (id === null) return { status: "not_found" as const };
  return getTour(id);
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const lookup = await loadTour(id).catch(() => null);
  if (lookup?.status !== "ok") return { title: dict.meta.notFoundTitle };
  const { tour } = lookup;
  const blurb =
    (locale === "zh-tw" ? tour.zhDescription : null) ??
    tour.description?.[0]?.map((run) => run.text).join("");
  return {
    title: (locale === "zh-tw" && tour.zhTitle) || tour.title,
    description: blurb || dict.tours.metaDescription,
    alternates: languageAlternates(locale, `/tours/${tour.id}`),
  };
}

export default async function TourPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.tours;
  const lookup = await loadTour(id);
  if (lookup.status !== "ok") notFound();
  const { tour } = lookup;

  const zh = locale === "zh-tw";
  const title = (zh && tour.zhTitle) || tour.title;
  const zhBlurb = zh ? tour.zhDescription : null;
  const about = tour.intro ?? tour.description;
  const facts = [
    tour.minutes ? format(t.minutes, { count: tour.minutes }) : null,
    format(t.stops, { count: tour.stops.length }),
    tour.hasChinese ? t.mandarin : null,
  ].filter(Boolean);

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <Link
          href={localizePath(locale, "/tours")}
          className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
        >
          <ArrowLeft className="size-4" />
          {t.all}
        </Link>
      </Container>

      <Container className="mt-10 lg:mt-14">
        <header className="max-w-4xl animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.heading}
          </p>
          <h1
            lang={title === tour.title ? "en" : undefined}
            className="mt-5 font-serif text-5xl leading-[1.04] tracking-tight text-balance sm:text-6xl"
          >
            {title}
          </h1>
          <p className="mt-5 font-serif text-2xl text-muted italic">
            {facts.join(" · ")}
          </p>
          {zhBlurb ? (
            <p className="mt-6 text-lg leading-8 text-ink/90">{zhBlurb}</p>
          ) : about ? (
            <div
              lang="en"
              className="mt-6 space-y-3 font-serif text-lg leading-8 text-ink/90 sm:text-xl sm:leading-9"
            >
              {about.map((paragraph, index) => (
                <p key={index}>
                  {paragraph.map((run, runIndex) =>
                    run.italic ? <em key={runIndex}>{run.text}</em> : run.text,
                  )}
                </p>
              ))}
            </div>
          ) : null}
        </header>
      </Container>

      <Container className="mt-12">
        <TourPlayer tour={tour} />
        <Credit
          text={t.credit}
          dict={dict}
          href={MUSEUM_SITE}
          className="mt-10 text-xs text-muted"
        />
      </Container>
    </article>
  );
}
