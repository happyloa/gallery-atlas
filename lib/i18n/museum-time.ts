/** Dates and times at the museum, written for the visitor's language. */
import { LOCALE_TAGS } from "./config";
import type { Locale } from "./config";

const TIME_ZONE = "America/Chicago";

/** "Wednesday, November 18" from a YYYY-MM-DD day at the museum. */
export function formatMuseumDay(day: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    weekday: "long",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day}T00:00:00Z`));
}

/** The time of an instant, at the museum. */
export function formatMuseumTime(iso: string, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TIME_ZONE,
  }).format(new Date(iso));
}

/** A clock time given as minutes after midnight. */
export function formatClock(minutes: number, locale: Locale): string {
  return new Intl.DateTimeFormat(LOCALE_TAGS[locale], {
    hour: "numeric",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(minutes * 60_000));
}

export function formatPrice(amount: number, locale: Locale): string {
  return new Intl.NumberFormat(LOCALE_TAGS[locale], {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Number.isInteger(amount) ? 0 : 2,
  }).format(amount);
}
