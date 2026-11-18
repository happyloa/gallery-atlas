import { exhibitionStatus } from "@/lib/artic/museum";
import type { MuseumExhibition } from "@/lib/artwork/types";
import { LOCALE_TAGS } from "@/lib/i18n/config";
import type { Locale } from "@/lib/i18n/config";
import type { Dictionary } from "@/lib/i18n/dictionaries";
import { format } from "@/lib/i18n/format";
import { cn } from "@/lib/utils";

/** Today's date (UTC) as YYYY-MM-DD, for comparing with exhibition dates. */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

/** "12 May 2024 – 3 September 2024", or one end when only one is known. */
export function exhibitionDates(
  exhibition: Pick<MuseumExhibition, "start" | "end">,
  locale: Locale,
  dict: Dictionary,
): string | null {
  const t = dict.museumExhibitions;
  const date = (iso: string) =>
    new Date(`${iso}T00:00:00Z`).toLocaleDateString(LOCALE_TAGS[locale], {
      day: "numeric",
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    });
  const { start, end } = exhibition;
  if (start && end)
    return format(t.dates, { start: date(start), end: date(end) });
  if (start) return format(t.from, { start: date(start) });
  if (end) return format(t.until, { end: date(end) });
  return null;
}

export function ExhibitionStatus({
  exhibition,
  dict,
  className,
}: {
  exhibition: Pick<MuseumExhibition, "start" | "end">;
  dict: Dictionary;
  className?: string;
}) {
  const status = exhibitionStatus(exhibition, todayIso());
  if (!status) return null;
  return (
    <span
      className={cn(
        "inline-flex items-center gap-2 text-xs font-medium tracking-[0.14em] uppercase",
        status === "current" ? "text-accent-deep" : "text-muted",
        className,
      )}
    >
      {status === "current" ? (
        <span
          aria-hidden="true"
          className="size-1.5 rounded-full bg-accent shadow-[0_0_0_3px_rgb(155_75_56/0.18)]"
        />
      ) : null}
      {dict.museumExhibitions.status[status]}
    </span>
  );
}
