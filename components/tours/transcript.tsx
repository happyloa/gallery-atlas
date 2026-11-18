"use client";

import { useEffect, useState } from "react";
import { Plus } from "@/components/ui/icons";
import type { TextRun } from "@/lib/artwork/types";
import { useI18n } from "@/lib/i18n/provider";

/**
 * A recording's transcript, folded until opened. English text arrives with the page; the
 * Chinese text is a static file fetched on first open, and English stands in if it's missing.
 */
export function Transcript({
  soundId,
  transcript,
  chinese,
}: {
  soundId: number;
  transcript: TextRun[][] | null;
  /** Show the Chinese transcript, for a recording being heard in Mandarin. */
  chinese: boolean;
}) {
  const { dict } = useI18n();
  const [loaded, setLoaded] = useState<Record<number, string[] | null>>({});
  const [open, setOpen] = useState(false);
  const paragraphs = loaded[soundId];

  useEffect(() => {
    if (!open || !chinese || paragraphs !== undefined) return;
    let cancelled = false;
    const store = (lines: string[] | null) => {
      if (!cancelled) setLoaded((all) => ({ ...all, [soundId]: lines }));
    };
    fetch(`/tour-transcripts/${soundId}.json`)
      .then((response) =>
        response.ok
          ? (response.json() as Promise<{ paragraphs?: unknown }>)
          : null,
      )
      .then((body) => {
        const lines = Array.isArray(body?.paragraphs)
          ? body.paragraphs.filter((l): l is string => typeof l === "string")
          : null;
        store(lines);
      })
      .catch(() => store(null));
    return () => {
      cancelled = true;
    };
  }, [open, chinese, paragraphs, soundId]);

  if (!transcript && !chinese) return null;
  const showChinese = chinese && paragraphs;

  return (
    <details
      className="group/transcript mt-4 border-t border-line"
      onToggle={(event) => setOpen(event.currentTarget.open)}
    >
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-4 text-sm [&::-webkit-details-marker]:hidden">
        {dict.tours.transcript}
        <Plus
          aria-hidden="true"
          className="size-4 shrink-0 transition-transform duration-300 ease-gallery group-open/transcript:rotate-45"
        />
      </summary>
      <div
        lang={showChinese ? "zh-Hant-TW" : "en"}
        className="max-w-2xl space-y-3 pb-4 text-sm leading-7 text-ink/85"
      >
        {showChinese
          ? paragraphs.map((line, index) => <p key={index}>{line}</p>)
          : transcript?.map((paragraph, index) => (
              <p key={index}>
                {paragraph.map((run, runIndex) =>
                  run.italic ? <em key={runIndex}>{run.text}</em> : run.text,
                )}
              </p>
            ))}
      </div>
    </details>
  );
}
