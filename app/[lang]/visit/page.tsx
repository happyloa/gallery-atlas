import type { Metadata } from "next";
import Link from "next/link";
import { ResultsError } from "@/components/discover/results-error";
import { EventRow } from "@/components/library/event-rows";
import { eyebrowClass, OutLink, PageHeader } from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { ArrowRight } from "@/components/ui/icons";
import {
  getHours,
  getOccurrences,
  museumClock,
  museumDay,
  openState,
} from "@/lib/artic/events";
import type { MuseumHours, OpenState } from "@/lib/artic/events";
import { localizePath } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { formatClock } from "@/lib/i18n/museum-time";
import { attempt, languageAlternates, localeOf } from "@/lib/page-params";
import { cn } from "@/lib/utils";

type Params = Promise<{ lang: string }>;

// Whether the museum is open depends on the moment of the request.
export const dynamic = "force-dynamic";

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  return {
    title: dict.visit.heading,
    description: dict.visit.metaDescription,
    alternates: languageAlternates(locale, "/visit"),
  };
}

function statusText(
  state: OpenState,
  locale: Locale,
  dict: Dictionary,
): string {
  const t = dict.visit.status;
  const clock = (minutes: number) => formatClock(minutes, locale);
  switch (state.state) {
    case "open":
      return format(t.open, { time: clock(state.until) });
    case "members":
      return format(t.members, { time: clock(state.publicAt) });
    case "later":
      return format(t.later, { time: clock(state.opensAt) });
    case "closed":
      return state.next?.publicOpen != null
        ? format(t.closedNext, {
            day: dict.visit.days[state.next.day],
            time: clock(state.next.publicOpen),
          })
        : t.closed;
  }
}

function HoursTable({
  hours,
  locale,
  dict,
  now,
}: {
  hours: MuseumHours;
  locale: Locale;
  dict: Dictionary;
  now: Date;
}) {
  const t = dict.visit;
  const today = museumClock(now).day;
  return (
    <table className="w-full max-w-2xl border-collapse text-[0.9375rem]">
      <caption className="sr-only">{t.hoursHeading}</caption>
      <tbody>
        {hours.days.map((day) => (
          <tr
            key={day.day}
            aria-current={day.day === today ? "date" : undefined}
            className={cn(
              "border-b border-line",
              day.day === today && "font-medium",
            )}
          >
            <th scope="row" className="py-3 pr-6 text-left font-[inherit]">
              {t.days[day.day]}
            </th>
            <td className="py-3 pr-6 tabular-nums">
              {day.closed || day.publicOpen === null || day.publicClose === null
                ? t.closed
                : `${formatClock(day.publicOpen, locale)} – ${formatClock(day.publicClose, locale)}`}
            </td>
            <td className="hidden py-3 text-right text-sm text-muted tabular-nums sm:table-cell">
              {!day.closed && day.memberOpen !== null
                ? format(t.membersFrom, {
                    time: formatClock(day.memberOpen, locale),
                  })
                : null}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default async function VisitPage({ params }: { params: Params }) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.visit;
  const now = new Date();
  const today = museumDay(now);

  const [hours, events] = await Promise.all([
    attempt(getHours),
    getOccurrences({ today, limit: 12 }).catch(() => null),
  ]);
  const todays = events?.items.filter((item) => item.day === today) ?? [];
  const state = hours.data ? openState(hours.data, now) : null;

  const plan = [
    { href: "/events", label: dict.nav.events },
    { href: "/exhibitions", label: dict.site.exhibitions },
    { href: "/galleries", label: dict.site.galleries },
    { href: "/tours", label: dict.site.tours },
  ];

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading}>
          {state ? (
            <p className="mt-6 flex items-center gap-3 font-serif text-2xl sm:text-3xl">
              <span
                aria-hidden="true"
                className={cn(
                  "size-2.5 shrink-0 rounded-full",
                  state.state === "open"
                    ? "bg-[#4f7a4a] shadow-[0_0_0_4px_rgb(79_122_74/0.18)]"
                    : "border border-ink/40",
                )}
              />
              {statusText(state, locale, dict)}
            </p>
          ) : null}
          <p className="mt-3 text-sm text-muted">{dict.events.chicagoTime}</p>
        </PageHeader>
      </Container>

      <Container className="mt-14 grid gap-16 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-20">
        <section aria-labelledby="hours">
          <h2 id="hours" className={eyebrowClass}>
            {t.hoursHeading}
          </h2>
          {hours.failure ? <ResultsError {...hours.failure} /> : null}
          {hours.data ? (
            <div className="mt-4">
              <HoursTable
                hours={hours.data}
                locale={locale}
                dict={dict}
                now={now}
              />
              {hours.data.note ? (
                <p lang="en" className="mt-5 max-w-2xl text-sm text-ink/80">
                  {hours.data.note}
                </p>
              ) : null}
            </div>
          ) : null}
          <p className="mt-6 text-xs text-muted">{t.credit}</p>
        </section>

        <section aria-labelledby="plan">
          <h2 id="plan" className={eyebrowClass}>
            {t.planHeading}
          </h2>
          <ul className="mt-4 divide-y divide-line border-y border-line">
            {plan.map((item) => (
              <li key={item.href}>
                <Link
                  href={localizePath(locale, item.href)}
                  className="group flex min-h-14 items-center justify-between gap-4 font-serif text-2xl underline-offset-4 hover:underline"
                >
                  {item.label}
                  <ArrowRight
                    aria-hidden="true"
                    className="size-4 transition-transform duration-200 ease-gallery group-hover:translate-x-0.5"
                  />
                </Link>
              </li>
            ))}
          </ul>
          <div className="mt-6">
            <OutLink href="https://www.artic.edu/visit" dict={dict}>
              {t.officialInfo}
            </OutLink>
          </div>
        </section>
      </Container>

      <Container className="mt-20">
        <section aria-labelledby="today">
          <h2
            id="today"
            className="border-b border-ink/60 pb-3 font-serif text-3xl sm:text-4xl"
          >
            {t.todayHeading}
          </h2>
          {todays.length > 0 ? (
            <ul className="divide-y divide-line">
              {todays.map((occurrence) => (
                <EventRow
                  key={occurrence.id}
                  occurrence={occurrence}
                  locale={locale}
                />
              ))}
            </ul>
          ) : (
            <p className="mt-6 text-muted">{t.noEvents}</p>
          )}
        </section>
      </Container>
    </div>
  );
}
