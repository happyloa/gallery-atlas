"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { ArtworkCard } from "@/components/artwork/artwork-card";
import { Reveal } from "@/components/motion/reveal";
import { ResultsSkeleton } from "@/components/discover/results-skeleton";
import { Button, buttonStyles } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EmptyState } from "@/components/ui/empty-state";
import {
  ArrowLeft,
  ArrowUpRight,
  Pencil,
  Trash,
  X,
} from "@/components/ui/icons";
import { findExhibition, MAX_EXHIBITION_TITLE } from "@/lib/collections/schema";
import { useArtworks } from "@/lib/collections/use-artworks";
import {
  exhibitionActions,
  useCollection,
  useHydrated,
} from "@/lib/collections/use-collection";
import { localizePath } from "@/lib/i18n/config";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";

const EMPTY: readonly number[] = [];

/** One exhibition, read from this browser: rename, delete, and remove works. */
export function ExhibitionView({ id }: { id: string }) {
  const { locale, dict } = useI18n();
  const t = dict.exhibitions;
  const router = useRouter();
  const hydrated = useHydrated();
  const collection = useCollection();
  const exhibition = findExhibition(collection, id);
  const records = useArtworks(exhibition?.artworkIds ?? EMPTY);

  const inputId = useId();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  // Set when the link could not be copied, so it can be shown for copying by hand.
  const [shareFallback, setShareFallback] = useState("");
  const [copied, setCopied] = useState(false);

  const collectionHref = localizePath(locale, "/collection");

  useEffect(() => {
    if (exhibition) document.title = `${exhibition.title} · Gallery Atlas`;
  }, [exhibition]);

  // Keyboard focus must not fall back to the top of the page when the control it was on
  // goes away: the rename form closing, or a work being removed from the wall.
  const headingRef = useRef<HTMLHeadingElement>(null);
  const renameButton = useRef<HTMLButtonElement>(null);
  const wallRef = useRef<HTMLUListElement>(null);
  const wasEditing = useRef(false);
  useEffect(() => {
    if (wasEditing.current && !editing) renameButton.current?.focus();
    wasEditing.current = editing;
  }, [editing]);

  if (!hydrated)
    return <ResultsSkeleton label={dict.explore.loading} count={4} />;

  if (!exhibition) {
    return (
      <EmptyState
        headingLevel="h1"
        title={t.notFoundTitle}
        action={
          <Link href={collectionHref} className={buttonStyles()}>
            {t.backToCollection}
          </Link>
        }
      >
        <p>{t.notFoundBody}</p>
      </EmptyState>
    );
  }

  const count = exhibition.artworkIds.length;
  const countLabel =
    count === 0
      ? t.countZero
      : count === 1
        ? t.countOne
        : format(t.countOther, { count });

  const saveName = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const result = exhibitionActions.rename(exhibition.id, draft);
    if (result.ok) {
      setEditing(false);
      setError("");
      setStatus(t.renamed);
    } else {
      setError(
        result.reason === "storage" ? dict.favorite.storage : t.nameRequired,
      );
    }
  };

  const share = async () => {
    const params = new URLSearchParams({
      title: exhibition.title,
      ids: exhibition.artworkIds.join(","),
    });
    const url = `${window.location.origin}${localizePath(locale, "/collection/shared")}?${params}`;
    try {
      await navigator.clipboard.writeText(url);
      setShareFallback("");
      setCopied(true);
      setStatus(dict.share.copied);
    } catch {
      setCopied(false);
      setShareFallback(url);
    }
  };

  const confirmDelete = () => {
    const result = exhibitionActions.remove(exhibition.id);
    setConfirming(false);
    if (result.ok) router.push(collectionHref);
    else setError(dict.favorite.storage);
  };

  return (
    <>
      <Link
        href={collectionHref}
        className="inline-flex min-h-11 items-center gap-2 text-sm text-muted underline-offset-4 hover:text-ink hover:underline"
      >
        <ArrowLeft className="size-4" />
        {t.backToCollection}
      </Link>

      <header className="mt-6 flex flex-col gap-6 border-b border-line pb-8 lg:flex-row lg:items-end lg:justify-between">
        <div className="min-w-0">
          <p className="text-xs font-medium tracking-[0.18em] text-accent uppercase">
            {t.pageTitle}
          </p>
          {editing ? (
            <form
              onSubmit={saveName}
              className="mt-3 flex flex-wrap items-end gap-3"
            >
              <label htmlFor={inputId} className="sr-only">
                {t.renameLabel}
              </label>
              <input
                id={inputId}
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setEditing(false);
                }}
                maxLength={MAX_EXHIBITION_TITLE}
                // Focus moves to the field the visitor just asked to edit.
                // eslint-disable-next-line jsx-a11y/no-autofocus
                autoFocus
                className="min-h-12 w-full max-w-xl border-0 border-b border-ink bg-transparent font-serif text-4xl focus:outline-none focus-visible:outline-2 focus-visible:outline-offset-4 sm:text-5xl"
              />
              <Button type="submit" size="sm">
                {t.save}
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setEditing(false)}
              >
                {t.cancel}
              </Button>
            </form>
          ) : (
            <h1
              ref={headingRef}
              tabIndex={-1}
              className="mt-3 font-serif text-4xl break-words sm:text-6xl"
            >
              {exhibition.title}
            </h1>
          )}
          <p className="mt-3 text-sm text-muted">{countLabel}</p>
        </div>

        {!editing ? (
          <div className="flex shrink-0 flex-wrap items-center gap-3">
            {count > 0 ? (
              <Button variant="secondary" size="sm" onClick={share}>
                <ArrowUpRight className="size-4" />
                {copied ? dict.share.copied : dict.share.button}
              </Button>
            ) : null}
            <Button
              ref={renameButton}
              variant="secondary"
              size="sm"
              onClick={() => {
                setDraft(exhibition.title);
                setStatus("");
                setEditing(true);
              }}
            >
              <Pencil className="size-4" />
              {t.rename}
            </Button>
            <Button
              variant="secondary"
              size="sm"
              onClick={() => setConfirming(true)}
            >
              <Trash className="size-4" />
              {t.delete}
            </Button>
          </div>
        ) : null}
      </header>

      <p role="status" className="sr-only">
        {status}
      </p>
      {shareFallback ? (
        <div className="mt-4 flex flex-col gap-2 text-sm">
          <label htmlFor={`${inputId}-share`}>{dict.share.copyFallback}</label>
          <input
            id={`${inputId}-share`}
            readOnly
            value={shareFallback}
            onFocus={(event) => event.currentTarget.select()}
            className="min-h-11 w-full border border-line bg-paper px-3 font-mono text-xs"
          />
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="mt-4 text-sm text-accent-deep">
          {error}
        </p>
      ) : null}

      {records.unavailable.length > 0 ? (
        <div className="mt-6 flex flex-col items-start gap-3 rounded-sm border border-line bg-paper-deep p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p>
            {records.unavailable.length === 1
              ? dict.collection.unavailableOne
              : format(dict.collection.unavailable, {
                  count: records.unavailable.length,
                })}
          </p>
          <Button
            variant="secondary"
            size="sm"
            onClick={() =>
              exhibitionActions.removeWorks(exhibition.id, records.unavailable)
            }
          >
            {dict.collection.removeUnavailable}
          </Button>
        </div>
      ) : null}

      {records.failed ? (
        <div
          role="alert"
          className="mt-6 flex flex-wrap items-center gap-4 text-sm"
        >
          <p>{dict.collection.loadError}</p>
          <Button variant="secondary" size="sm" onClick={records.retry}>
            {dict.collection.retry}
          </Button>
        </div>
      ) : null}

      {count === 0 ? (
        <EmptyState title={t.emptyExhibitionTitle}>
          <p>{t.emptyExhibitionBody}</p>
        </EmptyState>
      ) : (
        <ul
          ref={wallRef}
          className="mt-12 grid grid-cols-1 gap-x-8 gap-y-16 min-[420px]:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4"
        >
          {records.artworks.map((artwork, index) => {
            const label = format(t.removeWork, { title: artwork.title });
            return (
              <Reveal as="li" key={artwork.id} delay={(index % 4) * 90}>
                <ArtworkCard
                  artwork={artwork}
                  locale={locale}
                  revealDelay={(index % 4) * 90}
                  action={
                    <button
                      type="button"
                      aria-label={label}
                      title={label}
                      data-remove-work=""
                      onClick={(event) => {
                        // This button is about to go: pass focus to the next work's, or
                        // the previous one's, or the heading when the wall is now empty.
                        const buttons = [
                          ...(wallRef.current?.querySelectorAll<HTMLElement>(
                            "[data-remove-work]",
                          ) ?? []),
                        ];
                        const at = buttons.indexOf(event.currentTarget);
                        const next = buttons[at + 1] ?? buttons[at - 1] ?? null;
                        const result = exhibitionActions.removeWorks(
                          exhibition.id,
                          artwork.id,
                        );
                        setStatus(result.ok ? t.workRemoved : "");
                        if (!result.ok) {
                          setError(dict.favorite.storage);
                          return;
                        }
                        (next ?? headingRef.current)?.focus();
                      }}
                      className="inline-flex size-11 items-center justify-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition-colors duration-200 ease-gallery hover:bg-paper"
                    >
                      <X className="size-4" />
                    </button>
                  }
                />
              </Reveal>
            );
          })}
        </ul>
      )}

      {records.pending > 0 ? (
        <ResultsSkeleton
          label={dict.explore.loading}
          count={Math.min(records.pending, 4)}
        />
      ) : null}

      <ConfirmDialog
        open={confirming}
        title={format(t.confirmTitle, { title: exhibition.title })}
        body={t.confirmBody}
        confirmLabel={t.confirmDelete}
        cancelLabel={t.cancel}
        onConfirm={confirmDelete}
        onCancel={() => setConfirming(false)}
      />
    </>
  );
}
