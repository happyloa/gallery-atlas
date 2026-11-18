import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cache } from "react";
import { timeRange } from "@/components/library/event-rows";
import {
  BackLink,
  eyebrowClass,
  OutLink,
  RichBody,
  SourceNote,
} from "@/components/library/parts";
import { buttonStyles } from "@/components/ui/button";
import { Container } from "@/components/ui/container";
import { getEvent, museumDay } from "@/lib/artic/events";
import { parseRecordId } from "@/lib/artic/records";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import { formatMuseumDay } from "@/lib/i18n/museum-time";
import { languageAlternates, localeOf } from "@/lib/page-params";

type Params = Promise<{ lang: string; id: string }>;

export const dynamic = "force-dynamic";

const loadEvent = cache(async (rawId: string) => {
  const id = parseRecordId(rawId);
  return id === null ? null : getEvent(id, museumDay(new Date()));
});

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const event = await loadEvent(id).catch(() => null);
  if (!event) return { title: dict.meta.notFoundTitle };
  return {
    title: event.title,
    description: event.description?.[0]
      ?.map((run) => run.text)
      .join("")
      .slice(0, 180),
    alternates: languageAlternates(locale, `/events/${id}`),
  };
}

export default async function EventPage({ params }: { params: Params }) {
  const { lang, id } = await params;
  const locale = localeOf(lang);
  const dict = getDictionary(locale);
  const t = dict.events;
  const event = await loadEvent(id);
  if (!event) notFound();

  const badges = (
    Object.keys(event.badges) as (keyof typeof event.badges)[]
  ).filter((badge) => event.badges[badge]);

  return (
    <article className="pb-24 sm:pb-32">
      <Container className="pt-8 sm:pt-10">
        <BackLink href={localizePath(locale, "/events")} label={t.allEvents} />
      </Container>

      <Container className="mt-8 grid gap-12 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-16">
        <header className="animate-rise [animation-delay:calc(var(--intro-delay)+120ms)]">
          <p className={eyebrowClass}>{event.programs[0] ?? t.heading}</p>
          <h1
            lang="en"
            className="mt-5 font-serif text-4xl leading-[1.08] tracking-tight text-balance sm:text-6xl"
          >
            {event.title}
          </h1>
          {event.dateDisplay ? (
            <p lang="en" className="mt-5 text-lg text-ink/85">
              {event.dateDisplay}
            </p>
          ) : null}
          {event.location ? (
            <p lang="en" className="mt-1 text-muted">
              {event.location}
            </p>
          ) : null}
          {badges.length > 0 ? (
            <ul className="mt-6 flex flex-wrap gap-1.5">
              {badges.map((badge) => (
                <li
                  key={badge}
                  className="inline-flex min-h-8 items-center rounded-full border border-ink/20 px-3 text-[0.8125rem]"
                >
                  {t.badges[badge]}
                </li>
              ))}
            </ul>
          ) : null}
          {event.actionUrl ? (
            <div className="mt-8">
              <OutLink
                href={event.actionUrl}
                dict={dict}
                className={buttonStyles()}
              >
                {t.tickets}
              </OutLink>
            </div>
          ) : null}
        </header>
        {event.image ? (
          <img
            src={event.image}
            alt=""
            width={1200}
            height={675}
            className="aspect-video w-full bg-paper-deep object-cover"
          />
        ) : null}
      </Container>

      <Container className="mt-14 grid gap-14 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-20">
        <div>
          {event.description ? (
            <RichBody
              sections={[{ heading: null, paragraphs: event.description }]}
            />
          ) : null}
          <SourceNote
            credit={t.credit}
            href={event.sourceUrl}
            label={t.viewAtMuseum}
            dict={dict}
          />
        </div>
        <aside aria-labelledby="dates">
          <h2 id="dates" className={eyebrowClass}>
            {t.upcomingDates}
          </h2>
          {event.occurrences.length > 0 ? (
            <ul className="mt-4 divide-y divide-line border-y border-line">
              {event.occurrences.map((occurrence) => (
                <li key={occurrence.id} className="py-3 text-sm">
                  <span className="block">
                    {formatMuseumDay(occurrence.day, locale)}
                  </span>
                  <span className="block text-muted tabular-nums">
                    {timeRange(occurrence, locale)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-4 text-sm text-muted">{t.noDates}</p>
          )}
          <p className="mt-4 text-xs text-muted">{t.chicagoTime}</p>
        </aside>
      </Container>
    </article>
  );
}
