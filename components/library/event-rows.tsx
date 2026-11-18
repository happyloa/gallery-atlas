import Link from "next/link";
import type { EventOccurrence } from "@/lib/artic/events";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { formatMuseumDay, formatMuseumTime } from "@/lib/i18n/museum-time";

export function timeRange(occurrence: EventOccurrence, locale: Locale): string {
  const start = formatMuseumTime(occurrence.start, locale);
  return occurrence.end
    ? `${start} – ${formatMuseumTime(occurrence.end, locale)}`
    : start;
}

/** One dated session of an event. */
export function EventRow({
  occurrence,
  locale,
}: {
  occurrence: EventOccurrence;
  locale: Locale;
}) {
  return (
    <li>
      <article className="group relative grid gap-4 py-6 sm:grid-cols-[9rem_minmax(0,1fr)_10rem] sm:gap-8">
        <p className="text-sm text-muted tabular-nums">
          {timeRange(occurrence, locale)}
        </p>
        <div lang="en">
          <h3 className="font-serif text-2xl leading-snug">
            <Link
              href={localizePath(locale, `/events/${occurrence.eventId}`)}
              prefetch={false}
              className="underline-offset-4 after:absolute after:inset-0 after:content-[''] group-hover:underline focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-2 focus-visible:after:outline-accent"
            >
              {occurrence.title}
            </Link>
          </h3>
          {occurrence.location ? (
            <p className="mt-1 text-sm text-muted">{occurrence.location}</p>
          ) : null}
          {occurrence.summary ? (
            <p className="mt-2 text-sm leading-6 text-ink/75">
              {occurrence.summary}
            </p>
          ) : null}
        </div>
        {occurrence.image ? (
          <img
            src={occurrence.image}
            alt=""
            loading="lazy"
            decoding="async"
            width={320}
            height={180}
            className="hidden aspect-video w-full bg-paper-deep object-cover sm:block"
          />
        ) : null}
      </article>
    </li>
  );
}

/** Sessions grouped under the day they fall on at the museum. */
export function EventDays({
  occurrences,
  locale,
  todayLabel,
  today,
}: {
  occurrences: EventOccurrence[];
  locale: Locale;
  todayLabel: string;
  today: string;
}) {
  const days = new Map<string, EventOccurrence[]>();
  for (const occurrence of occurrences)
    days.set(occurrence.day, [...(days.get(occurrence.day) ?? []), occurrence]);
  return (
    <div className="space-y-14">
      {[...days.entries()].map(([day, sessions]) => (
        <section key={day} aria-labelledby={`day-${day}`}>
          <h2
            id={`day-${day}`}
            className="border-b border-ink/60 pb-3 font-serif text-3xl"
          >
            {day === today ? `${todayLabel} · ` : null}
            {formatMuseumDay(day, locale)}
          </h2>
          <ul className="divide-y divide-line">
            {sessions.map((occurrence) => (
              <EventRow
                key={occurrence.id}
                occurrence={occurrence}
                locale={locale}
              />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
