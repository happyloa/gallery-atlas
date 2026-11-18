import type { Metadata } from "next";
import Link from "next/link";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { ResultsError } from "@/components/discover/results-error";
import { Credit, MUSEUM_SITE } from "@/components/library/parts";
import { Reveal } from "@/components/motion/reveal";
import { Container } from "@/components/ui/container";
import { describeFailure } from "@/lib/artic/error-reason";
import { getTourSummaries } from "@/lib/artic/tours";
import { fitClass } from "@/lib/artwork/fit";
import type { TourSummary } from "@/lib/artwork/types";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  return {
    title: dict.tours.heading,
    description: dict.tours.metaDescription,
    alternates: languageAlternates(locale, "/tours"),
  };
}

export default async function ToursPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.tours;

  let tours: TourSummary[] | null = null;
  let failure: ReturnType<typeof describeFailure> | null = null;
  try {
    tours = await getTourSummaries();
  } catch (caught) {
    failure = describeFailure(caught);
  }

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.eyebrow}
          </p>
          <h1 className="mt-5 font-serif text-5xl leading-[1.02] tracking-tight sm:text-6xl">
            {t.heading}
          </h1>
        </header>
      </Container>

      <Container className="mt-14 sm:mt-16">
        {failure ? <ResultsError {...failure} /> : null}
        <ul className="grid grid-cols-1 gap-x-8 gap-y-14 sm:grid-cols-2 lg:grid-cols-3">
          {tours?.map((tour, index) => {
            const zh = locale === "zh-tw";
            const title = (zh && tour.zhTitle) || tour.title;
            const zhBlurb = zh ? tour.zhDescription : null;
            const blurb =
              zhBlurb ??
              tour.description?.[0]?.map((run) => run.text).join("") ??
              null;
            const facts = [
              tour.minutes ? format(t.minutes, { count: tour.minutes }) : null,
              format(t.stops, { count: tour.stopCount }),
              tour.hasChinese ? t.mandarin : null,
            ].filter(Boolean);
            return (
              <Reveal as="li" key={tour.id} delay={(index % 3) * 90}>
                <article className="group relative">
                  <div className="flex aspect-[4/3] items-center justify-center bg-paper-deep p-6">
                    {tour.cover ? (
                      <ArtworkImage
                        image={{ ...tour.cover.image, alt: "" }}
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                        reveal={(index % 3) * 90}
                        className={`${fitClass(tour.cover.image.aspectRatio, 4 / 3)} shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-500 ease-gallery group-hover:scale-[1.02]`}
                        fallbackClassName="h-full w-full"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        lang="en"
                        className="line-clamp-4 px-2 text-center font-serif text-3xl leading-tight text-ink/60 italic"
                      >
                        {tour.title}
                      </span>
                    )}
                  </div>
                  <h2
                    lang={title === tour.title ? "en" : undefined}
                    className="mt-4 font-serif text-2xl leading-snug"
                  >
                    <Link
                      href={localizePath(locale, `/tours/${tour.id}`)}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
                    >
                      {title}
                    </Link>
                  </h2>
                  <p className="mt-1 text-sm text-muted">{facts.join(" · ")}</p>
                  {blurb ? (
                    <p
                      lang={zhBlurb ? undefined : "en"}
                      className="mt-2 line-clamp-3 text-sm leading-6 text-ink/80"
                    >
                      {blurb}
                    </p>
                  ) : null}
                </article>
              </Reveal>
            );
          })}
        </ul>
        {tours ? (
          <Credit
            text={t.credit}
            dict={dict}
            href={MUSEUM_SITE}
            className="mt-16 text-xs text-muted"
          />
        ) : null}
      </Container>
    </div>
  );
}
