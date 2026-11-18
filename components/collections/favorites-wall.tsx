"use client";

import Link from "next/link";
import { useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { Button, buttonStyles } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import type { Artwork } from "@/lib/artwork/types";
import { removeFavorites } from "@/lib/collections/schema";
import { update } from "@/lib/collections/store";
import { useCollection } from "@/lib/collections/use-collection";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";
import { FavoriteButton } from "./favorite-button";

const noop = () => () => {};
/** False during server render and hydration, true afterwards. */
function useHydrated(): boolean {
  return useSyncExternalStore(
    noop,
    () => true,
    () => false,
  );
}

interface Loaded {
  artworks: Map<number, Artwork>;
  unavailable: Set<number>;
}

/**
 * Saved works. The ids come from this browser; their records come from /api/artworks,
 * where the server checks every id again and drops anything not displayable. Only ids not
 * yet fetched are requested, so removing a work never triggers a reload.
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

  const [loaded, setLoaded] = useState<Loaded>({
    artworks: new Map(),
    unavailable: new Set(),
  });
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const missing = useMemo(
    () =>
      ids.filter(
        (id) => !loaded.artworks.has(id) && !loaded.unavailable.has(id),
      ),
    [ids, loaded],
  );
  const missingKey = missing.join(",");

  useEffect(() => {
    if (!missingKey) return;
    const controller = new AbortController();
    fetch(`/api/artworks?ids=${missingKey}`, { signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error(String(response.status));
        return (await response.json()) as {
          artworks: Artwork[];
          unavailable: number[];
        };
      })
      .then((body) => {
        setFailed(false);
        setLoaded((previous) => {
          const artworks = new Map(previous.artworks);
          for (const artwork of body.artworks)
            artworks.set(artwork.id, artwork);
          const unavailable = new Set(previous.unavailable);
          for (const id of body.unavailable) unavailable.add(id);
          return { artworks, unavailable };
        });
      })
      .catch((error: unknown) => {
        if (!controller.signal.aborted) {
          console.error(error);
          setFailed(true);
        }
      });
    return () => controller.abort();
  }, [missingKey, attempt]);

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

  const shown = ids.flatMap((id) => {
    const artwork = loaded.artworks.get(id);
    return artwork ? [artwork] : [];
  });
  const gone = ids.filter((id) => loaded.unavailable.has(id));
  const loading = missing.length > 0 && !failed;

  const removeGone = () => {
    update((state) => removeFavorites(state, gone));
  };

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
          <Button variant="secondary" size="sm" onClick={removeGone}>
            {t.removeUnavailable}
          </Button>
        </div>
      ) : null}

      {failed ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center gap-4 text-sm"
        >
          <p>{t.loadError}</p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() => setAttempt((n) => n + 1)}
          >
            {t.retry}
          </Button>
        </div>
      ) : null}

      {shown.length > 0 ? (
        <ul className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((artwork) => (
            <li key={artwork.id}>
              <ArtworkCard
                artwork={artwork}
                locale={locale}
                action={
                  <FavoriteButton
                    artworkId={artwork.id}
                    title={artwork.title}
                  />
                }
              />
            </li>
          ))}
        </ul>
      ) : null}

      {loading ? (
        <ResultsSkeleton
          label={dict.explore.loading}
          count={Math.min(missing.length, 4)}
        />
      ) : null}
    </section>
  );
}
