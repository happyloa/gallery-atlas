"use client";

import Link from "next/link";
import { useId, useMemo, useState } from "react";
import { ArtworkImage } from "@/components/artwork/artwork-image";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  MAX_EXHIBITION_TITLE,
  MAX_EXHIBITIONS,
} from "@/lib/collections/schema";
import { useArtworks } from "@/lib/collections/use-artworks";
import {
  exhibitionActions,
  useCollection,
  useHydrated,
} from "@/lib/collections/use-collection";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";

/** My Exhibitions on the collection page: start a new one, and a card for each. */
export function ExhibitionsSection() {
  const { locale, dict } = useI18n();
  const t = dict.exhibitions;
  const hydrated = useHydrated();
  const collection = useCollection();
  const inputId = useId();
  const hintId = useId();
  const [name, setName] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  // The first work of each exhibition is its cover.
  const coverIds = useMemo(
    () =>
      collection.exhibitions.flatMap((e) =>
        e.artworkIds[0] !== undefined ? [e.artworkIds[0]] : [],
      ),
    [collection.exhibitions],
  );
  const covers = useArtworks(coverIds);
  const coverFor = (id: number | undefined) =>
    covers.artworks.find((artwork) => artwork.id === id);

  const create = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = exhibitionActions.create(name);
    if (result.ok) {
      setName("");
      setError("");
      setStatus(format(t.created, { title: result.value.title }));
      return;
    }
    setStatus("");
    setError(
      result.reason === "limit"
        ? format(t.limitExhibitions, { max: MAX_EXHIBITIONS })
        : result.reason === "storage"
          ? dict.favorite.storage
          : t.nameRequired,
    );
  };

  const countLabel = (count: number) =>
    count === 0
      ? t.countZero
      : count === 1
        ? t.countOne
        : format(t.countOther, { count });

  return (
    <section aria-labelledby="exhibitions-heading" className="mt-20">
      <div className="border-y border-line py-4">
        <h2 id="exhibitions-heading" className="font-serif text-2xl">
          {t.heading}
        </h2>
        <p id={hintId} className="mt-1 max-w-2xl text-sm text-muted">
          {t.intro}
        </p>
      </div>

      <form onSubmit={create} className="mt-8 flex max-w-xl flex-col gap-2">
        <label
          htmlFor={inputId}
          className="text-xs font-medium tracking-[0.14em] text-muted uppercase"
        >
          {t.newLabel}
        </label>
        <div className="flex gap-2">
          <input
            id={inputId}
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={MAX_EXHIBITION_TITLE}
            placeholder={t.newPlaceholder}
            aria-describedby={hintId}
            className="min-h-12 min-w-0 flex-1 border-0 border-b border-ink/30 bg-transparent font-serif text-xl text-ink placeholder:text-muted/80 focus:border-ink focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4"
          />
          <Button type="submit" variant="secondary" disabled={!hydrated}>
            {t.create}
          </Button>
        </div>
        <p role="status" className="min-h-5 text-sm text-muted">
          {status}
        </p>
        {error ? (
          <p role="alert" className="text-sm text-accent-deep">
            {error}
          </p>
        ) : null}
      </form>

      {!hydrated ? (
        <Skeleton className="mt-8 h-40 w-full max-w-sm" />
      ) : collection.exhibitions.length === 0 ? (
        <div className="mt-8 max-w-xl text-muted">
          <p className="font-serif text-xl text-ink">{t.emptyTitle}</p>
          <p className="mt-2 text-sm">{t.emptyBody}</p>
        </div>
      ) : (
        <ul className="mt-10 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {collection.exhibitions.map((exhibition) => {
            const cover = coverFor(exhibition.artworkIds[0]);
            return (
              <li key={exhibition.id}>
                <article className="group relative">
                  <div className="flex aspect-[4/3] items-center justify-center bg-paper-deep p-6">
                    {cover ? (
                      <ArtworkImage
                        image={cover.image}
                        sizes="(min-width: 1024px) 30vw, (min-width: 640px) 45vw, 90vw"
                        className="h-auto max-h-full w-auto max-w-full shadow-[0_18px_30px_-18px_rgb(34_33_31/0.55)] transition-transform duration-300 ease-gallery group-hover:-translate-y-1"
                        fallbackClassName="h-full w-full"
                      />
                    ) : (
                      <div
                        className="h-3/4 w-1/2 border border-dashed border-ink/20"
                        aria-hidden="true"
                      />
                    )}
                  </div>
                  <h3 className="mt-4 font-serif text-xl">
                    <Link
                      href={localizePath(
                        locale,
                        `/collection/${exhibition.id}`,
                      )}
                      className="after:absolute after:inset-0 after:content-[''] focus-visible:outline-none focus-visible:after:outline-2 focus-visible:after:outline-offset-4 focus-visible:after:outline-accent"
                    >
                      {exhibition.title}
                    </Link>
                  </h3>
                  <p className="mt-1 text-sm text-muted">
                    {countLabel(exhibition.artworkIds.length)}
                  </p>
                </article>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
