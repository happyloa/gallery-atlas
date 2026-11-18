/** The museum's programme: events, their dated occurrences, programmes and opening hours. */
import { z } from "zod";
import type { TextRun } from "@/lib/artwork/types";
import { aicGet } from "./client";
import { REVALIDATE_REFERENCE, REVALIDATE_SEARCH } from "./config";
import { plainTitle } from "./museum";
import {
  articUrl,
  excerpt,
  imgixUrl,
  intField,
  listField,
  LIST_SIZE,
  parseCopy,
  readRecord,
  searchRecords,
  textField,
  toRecordPage,
} from "./records";
import type { RecordPage } from "./records";

export const MUSEUM_TIME_ZONE = "America/Chicago";

/** The calendar day at the museum (YYYY-MM-DD) for an instant. */
export function museumDay(when: Date | string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: MUSEUM_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(typeof when === "string" ? new Date(when) : when);
}

const rawOccurrence = z.object({
  id: z.string(),
  title: textField,
  title_display: textField,
  event_id: intField,
  short_description: textField,
  image_url: textField,
  start_at: z.string(),
  end_at: textField,
  location: textField,
  is_private: z.boolean().nullish().catch(null),
});

const OCCURRENCE_FIELDS =
  "id,title,title_display,event_id,short_description,image_url,start_at,end_at,location,is_private";

export interface EventOccurrence {
  id: string;
  eventId: number;
  title: string;
  summary: string | null;
  image: string | null;
  start: string;
  end: string | null;
  location: string | null;
  /** The museum's calendar day it falls on. */
  day: string;
}

function toOccurrence(
  raw: z.infer<typeof rawOccurrence>,
): EventOccurrence | null {
  const title =
    plainTitle(raw.title_display, 200) ?? plainTitle(raw.title, 200);
  if (!title || !raw.event_id || raw.is_private === true) return null;
  if (Number.isNaN(Date.parse(raw.start_at))) return null;
  return {
    id: raw.id,
    eventId: raw.event_id,
    title,
    summary: excerpt(parseCopy(raw.short_description)),
    image: imgixUrl(raw.image_url, 640),
    start: raw.start_at,
    end:
      raw.end_at && !Number.isNaN(Date.parse(raw.end_at)) ? raw.end_at : null,
    location: plainTitle(raw.location, 120),
    day: museumDay(raw.start_at),
  };
}

/** Events in one programme that are still to come. */
async function eventIdsInProgram(
  program: number,
  today: string,
): Promise<number[]> {
  const result = await searchRecords(
    "events",
    z.object({ id: z.number().int().positive() }),
    {
      filter: [
        { term: { program_ids: program } },
        { range: { end_date: { gte: today } } },
      ],
      fields: "id",
      limit: 100,
    },
    REVALIDATE_SEARCH,
  );
  return result.items.map((item) => item.id);
}

export async function getOccurrences({
  today,
  page = 1,
  program = null,
  limit = LIST_SIZE,
}: {
  today: string;
  page?: number;
  program?: number | null;
  limit?: number;
}): Promise<RecordPage<EventOccurrence>> {
  const eventIds =
    program !== null ? await eventIdsInProgram(program, today) : null;
  if (eventIds?.length === 0)
    return { items: [], total: 0, page, totalPages: 0, aggregations: {} };
  const result = await searchRecords(
    "event-occurrences",
    rawOccurrence,
    {
      filter: [
        { range: { start_at: { gte: today } } },
        { term: { is_private: false } },
        ...(eventIds ? [{ terms: { event_id: eventIds } }] : []),
      ],
      sort: [{ start_at: "asc" }],
      fields: OCCURRENCE_FIELDS,
      limit,
      page,
    },
    REVALIDATE_SEARCH,
  );
  return {
    ...result,
    items: result.items.flatMap((raw) => {
      const occurrence = toOccurrence(raw);
      // The filter is in UTC, so the evening before can slip in.
      return occurrence && occurrence.day >= today ? [occurrence] : [];
    }),
  };
}

export interface EventProgram {
  id: number;
  title: string;
  count: number;
}

const programBuckets = z.object({
  buckets: z.array(
    z.object({ key: z.number().int(), doc_count: z.number().int() }),
  ),
});

/** Programmes with something coming up, busiest first. */
export async function getPrograms(today: string): Promise<EventProgram[]> {
  const [titles, upcoming] = await Promise.all([
    aicGet("/event-programs?limit=100&fields=id,title", {
      revalidate: REVALIDATE_REFERENCE,
    }),
    searchRecords(
      "events",
      z.unknown(),
      {
        filter: [
          { range: { end_date: { gte: today } } },
          { term: { is_private: false } },
        ],
        limit: 0,
        aggs: { programs: { terms: { field: "program_ids", size: 60 } } },
      },
      REVALIDATE_SEARCH,
    ),
  ]);
  const name = new Map(
    toRecordPage(
      titles,
      z.object({ id: z.number().int(), title: textField }),
      100,
    ).items.map((raw) => [raw.id, plainTitle(raw.title, 80)]),
  );
  const buckets =
    programBuckets.safeParse(upcoming.aggregations.programs).data?.buckets ??
    [];
  return buckets.flatMap((bucket) => {
    const title = name.get(bucket.key);
    return title ? [{ id: bucket.key, title, count: bucket.doc_count }] : [];
  });
}

const EVENT_FIELDS =
  "id,title,title_display,image_url,hero_caption,short_description,description,location,program_titles,is_ticketed,rsvp_link,buy_button_text,is_registration_required,is_member_exclusive,is_sold_out,is_free,is_private,is_admission_required,is_virtual_event,date_display,start_date,end_date";

const flag = z.boolean().nullish().catch(null);

const rawEvent = z.object({
  id: z.number().int().positive(),
  title: textField,
  title_display: textField,
  image_url: textField,
  short_description: textField,
  description: textField,
  location: textField,
  program_titles: listField,
  rsvp_link: textField,
  buy_button_text: textField,
  is_ticketed: flag,
  is_registration_required: flag,
  is_member_exclusive: flag,
  is_sold_out: flag,
  is_free: flag,
  is_private: flag,
  is_admission_required: flag,
  is_virtual_event: flag,
  date_display: textField,
});

export interface MuseumEvent {
  id: number;
  title: string;
  image: string | null;
  description: TextRun[][] | null;
  location: string | null;
  dateDisplay: string | null;
  programs: string[];
  badges: {
    free: boolean;
    ticketed: boolean;
    registration: boolean;
    members: boolean;
    soldOut: boolean;
    admission: boolean;
    virtual: boolean;
  };
  actionUrl: string | null;
  actionLabel: string | null;
  sourceUrl: string;
  occurrences: EventOccurrence[];
}

export async function getEvent(
  id: number,
  today: string,
): Promise<MuseumEvent | null> {
  const raw = await readRecord(
    `/events/${id}?fields=${EVENT_FIELDS}`,
    rawEvent,
    REVALIDATE_SEARCH,
  );
  const title =
    plainTitle(raw?.title_display, 200) ?? plainTitle(raw?.title, 200);
  if (!raw || !title || raw.is_private === true) return null;

  const occurrences = await searchRecords(
    "event-occurrences",
    rawOccurrence,
    {
      filter: [
        { term: { event_id: id } },
        { range: { start_at: { gte: today } } },
      ],
      sort: [{ start_at: "asc" }],
      fields: OCCURRENCE_FIELDS,
      limit: 30,
    },
    REVALIDATE_SEARCH,
  ).catch(() => null);

  return {
    id,
    title,
    image: imgixUrl(raw.image_url, 1200),
    description: parseCopy(raw.description) ?? parseCopy(raw.short_description),
    location: plainTitle(raw.location, 120),
    dateDisplay: plainTitle(raw.date_display, 120),
    programs: (raw.program_titles ?? []).flatMap((value) => {
      const program = typeof value === "string" ? plainTitle(value, 80) : null;
      return program ? [program] : [];
    }),
    badges: {
      free: raw.is_free === true,
      ticketed: raw.is_ticketed === true,
      registration: raw.is_registration_required === true,
      members: raw.is_member_exclusive === true,
      soldOut: raw.is_sold_out === true,
      admission: raw.is_admission_required === true,
      virtual: raw.is_virtual_event === true,
    },
    actionUrl: articUrl(raw.rsvp_link),
    actionLabel: plainTitle(raw.buy_button_text, 40),
    sourceUrl: `https://www.artic.edu/events/${id}`,
    occurrences: (occurrences?.items ?? []).flatMap((occurrence) => {
      const mapped = toOccurrence(occurrence);
      return mapped ? [mapped] : [];
    }),
  };
}

/* Opening hours -------------------------------------------------------------------------- */

export const WEEKDAYS = [
  "monday",
  "tuesday",
  "wednesday",
  "thursday",
  "friday",
  "saturday",
  "sunday",
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export interface DayHours {
  day: Weekday;
  closed: boolean;
  /** Minutes after midnight. */
  memberOpen: number | null;
  publicOpen: number | null;
  publicClose: number | null;
}

/** "PT10H30M" → 630. */
export function durationMinutes(value: unknown): number | null {
  if (typeof value !== "string") return null;
  const match = /^PT(?:(\d{1,2})H)?(?:(\d{1,2})M)?$/.exec(value);
  if (!match || (!match[1] && !match[2])) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}

export interface MuseumHours {
  days: DayHours[];
  note: string | null;
}

export async function getHours(): Promise<MuseumHours | null> {
  const json = await aicGet("/hours?limit=1", {
    revalidate: REVALIDATE_REFERENCE,
  });
  const record = toRecordPage(json, z.record(z.string(), z.unknown()), 1)
    .items[0];
  if (!record) return null;
  return {
    days: WEEKDAYS.map((day) => ({
      day,
      closed: record[`${day}_is_closed`] === true,
      memberOpen: durationMinutes(record[`${day}_member_open`]),
      publicOpen: durationMinutes(record[`${day}_public_open`]),
      publicClose: durationMinutes(record[`${day}_public_close`]),
    })),
    note:
      typeof record.additional_text === "string"
        ? plainTitle(record.additional_text, 240)
        : null,
  };
}

export type OpenState =
  | { state: "open"; until: number }
  | { state: "members"; publicAt: number }
  | { state: "later"; opensAt: number }
  | { state: "closed"; next: DayHours | null };

/** Weekday and minutes after midnight at the museum. */
export function museumClock(now: Date): { day: Weekday; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MUSEUM_TIME_ZONE,
    weekday: "long",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(now);
  const part = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";
  return {
    day: part("weekday").toLowerCase() as Weekday,
    minutes: Number(part("hour")) * 60 + Number(part("minute")),
  };
}

/** Whether the museum is open at `now`, and what happens next. */
export function openState(hours: MuseumHours, now: Date): OpenState {
  const { day, minutes } = museumClock(now);
  const index = WEEKDAYS.indexOf(day);
  const today = hours.days[index];
  if (
    today &&
    !today.closed &&
    today.publicOpen !== null &&
    today.publicClose !== null
  ) {
    if (minutes >= today.publicOpen && minutes < today.publicClose)
      return { state: "open", until: today.publicClose };
    if (minutes < today.publicOpen) {
      if (today.memberOpen !== null && minutes >= today.memberOpen)
        return { state: "members", publicAt: today.publicOpen };
      return { state: "later", opensAt: today.publicOpen };
    }
  }
  for (let offset = 1; offset <= 7; offset++) {
    const next = hours.days[(index + offset) % 7];
    if (next && !next.closed && next.publicOpen !== null)
      return { state: "closed", next };
  }
  return { state: "closed", next: null };
}
