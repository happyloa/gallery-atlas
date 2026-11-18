"use client";

import { useState } from "react";
import { Bookmark } from "@/components/ui/icons";
import { MAX_FAVORITES } from "@/lib/collections/schema";
import { useFavorite } from "@/lib/collections/use-collection";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { cn } from "@/lib/utils";

export interface FavoriteButtonProps {
  artworkId: number;
  title: string;
  /** "icon" sits on a card image; "full" is a labelled button for the detail page. */
  variant?: "icon" | "full";
  className?: string;
}

/**
 * Saves or removes a work. A toggle button (aria-pressed) whose name says what it will do;
 * the outcome is announced politely, and a failure (full collection, blocked storage) is
 * shown as an alert.
 */
export function FavoriteButton({
  artworkId,
  title,
  variant = "icon",
  className,
}: FavoriteButtonProps) {
  const { dict } = useI18n();
  const t = dict.favorite;
  const { saved, toggle } = useFavorite(artworkId);
  const [announcement, setAnnouncement] = useState("");
  const [error, setError] = useState("");

  const onClick = () => {
    const result = toggle();
    if (result.ok) {
      setError("");
      setAnnouncement(
        result.value === "saved" ? t.announceSaved : t.announceRemoved,
      );
    } else {
      setAnnouncement("");
      setError(
        result.reason === "limit"
          ? format(t.limit, { max: MAX_FAVORITES })
          : t.storage,
      );
    }
  };

  const label = format(saved ? t.removeLabel : t.saveLabel, { title });

  return (
    <div
      className={cn(
        variant === "full" ? "flex flex-col items-start gap-2" : "relative",
        className,
      )}
    >
      <button
        type="button"
        onClick={onClick}
        aria-pressed={saved}
        aria-label={variant === "icon" ? label : undefined}
        title={variant === "icon" ? label : undefined}
        className={cn(
          "inline-flex items-center justify-center gap-2 transition-colors duration-200 ease-gallery",
          variant === "icon"
            ? cn(
                "size-11 rounded-full shadow-sm backdrop-blur",
                saved
                  ? "bg-ink text-paper"
                  : "bg-paper/90 text-ink hover:bg-paper",
              )
            : cn(
                "min-h-12 rounded-full border px-6 text-sm font-medium",
                saved
                  ? "border-ink bg-ink text-paper"
                  : "border-ink/30 text-ink hover:border-ink",
              ),
        )}
      >
        <Bookmark filled={saved} className="size-[1.15rem]" />
        {variant === "full" ? (
          <>
            <span>{saved ? t.saved : t.save}</span>
            <span className="sr-only">{` (${title})`}</span>
          </>
        ) : null}
      </button>
      <span className="sr-only" role="status" aria-live="polite">
        {announcement}
      </span>
      {error ? (
        <p
          role="alert"
          className={cn(
            "text-sm text-accent-deep",
            variant === "icon" &&
              "absolute top-full right-0 mt-2 w-56 rounded-md bg-paper p-2 shadow-lg",
          )}
        >
          {error}
        </p>
      ) : null}
    </div>
  );
}
