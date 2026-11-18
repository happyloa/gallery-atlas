"use client";

import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { MAX_EXHIBITIONS } from "@/lib/collections/schema";
import { exhibitionActions, useHydrated } from "@/lib/collections/use-collection";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";

/** Saves a shared exhibition into this browser's own list. */
export function SaveShared({
  title,
  artworkIds,
}: {
  title: string;
  artworkIds: readonly number[];
}) {
  const { locale, dict } = useI18n();
  const hydrated = useHydrated();
  const [saved, setSaved] = useState<{ id: string; title: string } | null>(null);
  const [error, setError] = useState("");

  const save = () => {
    const result = exhibitionActions.importShared(title, artworkIds);
    if (result.ok) {
      setError("");
      setSaved({ id: result.value.id, title: result.value.title });
      return;
    }
    setError(
      result.reason === "limit"
        ? format(dict.exhibitions.limitExhibitions, { max: MAX_EXHIBITIONS })
        : dict.favorite.storage,
    );
  };

  return (
    <div className="flex flex-col items-start gap-3">
      {saved ? (
        <p role="status" className="text-sm">
          {format(dict.share.saved, { title: saved.title })}{" "}
          <Link
            href={localizePath(locale, `/collection/${saved.id}`)}
            className="underline underline-offset-4"
          >
            {dict.share.viewSaved}
          </Link>
        </p>
      ) : (
        <Button onClick={save} disabled={!hydrated}>
          {dict.share.save}
        </Button>
      )}
      {error ? (
        <p role="alert" className="text-sm text-accent-deep">
          {error}
        </p>
      ) : null}
    </div>
  );
}
