"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { removeFavorites } from "@/lib/collections/schema";
import { update } from "@/lib/collections/store";
import { useArtworks } from "@/lib/collections/use-artworks";
import { useCollection, useHydrated } from "@/lib/collections/use-collection";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { ExhibitionPicker } from "./exhibition-picker";
import { FavoriteButton } from "./favorite-button";

/**
 * Saved works. The ids come from this browser; their records come from /api/artworks,
 * where the server checks every id again and drops anything not displayable.
 */
export function FavoritesWall() {
  const { locale, dict } = useI18n();
  const t = dict.collection;
  const hydrated = useHydrated();
  const collection = useCollection();
  const ids = useMemo(
    () => collection.favorites.map((favorite) => favorite.id),
    [collection.favorites],
  );
  const records = useArtworks(ids);

  if (!hydrated)
    return <ResultsSkeleton label={dict.explore.loading} count={4} />;

  if (ids.length === 0) {
    return (
      <EmptyState
        title={t.emptyTitle}
        action={
          <Link
            href={`${localizePath(locale, "/")}#explore`}
            className={buttonStyles()}
          >
            {t.explore}
          </Link>
        }
      >
        <p>{t.emptyBody}</p>
      </EmptyState>
    );
  }

  const gone = records.unavailable;

  return (
    <section aria-labelledby="favorites-heading" className="mt-12">
      <div className="flex flex-col gap-2 border-y border-line py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 id="favorites-heading" className="font-serif text-2xl">
          {t.favoritesHeading}
        </h2>
        <p className="text-sm text-muted">
          {ids.length === 1
            ? t.favoritesCountOne
            : format(t.favoritesCount, { count: ids.length })}{" "}
          · {t.localOnly}
        </p>
      </div>

      {gone.length > 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-sm border border-line bg-paper-deep p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            {gone.length === 1
              ? t.unavailableOne
              : format(t.unavailable, { count: gone.length })}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => update((state) => removeFavorites(state, gone))}
          >
            {t.removeUnavailable}
          </Button>
        </div>
      ) : null}

      {records.failed ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center gap-4 text-sm"
        >
          <p>{t.loadError}</p>
          <Button variant="secondary" size="sm" onClick={records.retry}>
            {t.retry}
          </Button>
        </div>
      ) : null}

      {records.artworks.length > 0 ? (
        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {records.artworks.map((artwork) => (
            <li key={artwork.id}>
              <ArtworkCard
                artwork={artwork}
                locale={locale}
                action={
                  <div className="flex gap-2">
                    <ExhibitionPicker
                      artworkId={artwork.id}
                      title={artwork.title}
                    />
                    <FavoriteButton
                      artworkId={artwork.id}
                      title={artwork.title}
                    />
                  </div>
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {records.pending > 0 ? (
        <ResultsSkeleton
          label={dict.explore.loading}
          count={Math.min(records.pending, 4)}
        />
      ) : null}
    </section>
  );
}
