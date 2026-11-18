import type { Metadata } from "next";
import { ResultsError } from "@/components/discover/results-error";
import { EventDays } from "@/components/library/event-rows";
import {
  FilterChips,
  ListPagination,
  PageHeader,
} from "@/components/library/parts";
import { Container } from "@/components/ui/container";
import { getOccurrences, getPrograms, museumDay } from "@/lib/artic/events";
import { localizePath } from "@/lib/i18n/config";
import { getDictionary } from "@/lib/i18n/dictionaries";
import {
  attempt,
  languageAlternates,
  localeOf,
  pageParam,
  stringParam,
  withQuery,
} from "@/lib/page-params";
import type { RouteSearchParams } from "@/lib/page-params";

type Params = Promise<{ lang: string }>;

export const dynamic = "force-dynamic";

const MAX_PROGRAM_CHIPS = 12;

export async function generateMetadata({
  params,
}: {
  params: Params;
}): Promise<Metadata> {
  const dict = getDictionary(localeOf((await params).lang));
  return {
    title: dict.events.heading,
    description: dict.events.metaDescription,
    alternates: languageAlternates("/events"),
  };
}

export default async function EventsPage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: Promise<RouteSearchParams>;
}) {
  const locale = localeOf((await params).lang);
  const dict = getDictionary(locale);
  const t = dict.events;
  const query = await searchParams;
  const page = pageParam(query);
  const rawProgram = stringParam(query, "program");
  const program =
    rawProgram && /^\d{1,4}$/.test(rawProgram) ? Number(rawProgram) : null;

  const today = museumDay(new Date());
  const base = localizePath(locale, "/events");
  const [result, programs] = await Promise.all([
    attempt(() => getOccurrences({ today, page, program })),
    getPrograms(today).catch(() => []),
  ]);

  return (
    <div className="pb-24 sm:pb-32">
      <Container className="pt-14 sm:pt-20">
        <PageHeader eyebrow={t.eyebrow} title={t.heading}>
          <p className="mt-5 text-sm text-muted">{t.chicagoTime}</p>
        </PageHeader>
        {programs.length > 0 ? (
          <div className="mt-10">
            <FilterChips
              label={t.programLabel}
              items={[
                {
                  key: "all",
                  href: base,
                  label: t.allPrograms,
                  active: program === null,
                },
                ...programs
                  .filter(
                    (item, index) =>
                      index < MAX_PROGRAM_CHIPS || item.id === program,
                  )
                  .map((item) => ({
                    key: String(item.id),
                    href: withQuery(base, { program: item.id }),
                    label: item.title,
                    lang: "en",
                    active: item.id === program,
                  })),
              ]}
            />
          </div>
        ) : null}
      </Container>

      <Container className="mt-14">
        {result.failure ? <ResultsError {...result.failure} /> : null}
        {result.data?.items.length === 0 ? (
          <p className="text-muted">{dict.common.nothing}</p>
        ) : null}
        {result.data?.items.length ? (
          <>
            <EventDays
              occurrences={result.data.items}
              locale={locale}
              today={today}
              todayLabel={t.today}
            />
            <ListPagination
              locale={locale}
              dict={dict}
              page={page}
              totalPages={result.data.totalPages}
              hrefFor={(next) => withQuery(base, { program, page: next })}
            />
          </>
        ) : null}
        <p className="mt-16 text-xs text-muted">{t.credit}</p>
      </Container>
    </div>
  );
}
