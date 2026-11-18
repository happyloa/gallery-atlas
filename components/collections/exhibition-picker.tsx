"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Button, buttonStyles } from "@/components/ui/button";
import { FramePlus, X } from "@/components/ui/icons";
import {
  MAX_EXHIBITION_ITEMS,
  MAX_EXHIBITION_TITLE,
  MAX_EXHIBITIONS,
} from "@/lib/collections/schema";
import type { WriteResult } from "@/lib/collections/store";
import {
  exhibitionActions,
  useCollection,
} from "@/lib/collections/use-collection";
import { format } from "@/lib/i18n/format";
import { useI18n } from "@/lib/i18n/provider";

export interface ExhibitionPickerProps {
  artworkId: number;
  title: string;
  variant?: "icon" | "full";
}

/**
 * "Add to exhibition": a modal with one checkbox per exhibition (ticking adds, unticking
 * removes, at once) and a form to start a new exhibition with this work in it.
 *
 * A wall of saved works has one of these per card, so the closed dialog is an empty
 * element: its contents, and their subscription to the collection, exist only while open.
 */
export function ExhibitionPicker({
  artworkId,
  title,
  variant = "icon",
}: ExhibitionPickerProps) {
  const { dict } = useI18n();
  const t = dict.exhibitions;
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingId = useId();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    // Covers every way of closing: the buttons, Escape, and a form with method="dialog".
    const onClose = () => setOpen(false);
    dialog.addEventListener("close", onClose);
    return () => dialog.removeEventListener("close", onClose);
  }, []);

  // Opened once the contents are in the document, so focus lands on the first control.
  useEffect(() => {
    const dialog = dialogRef.current;
    if (open && dialog && !dialog.open) dialog.showModal();
  }, [open]);

  const show = () => setOpen(true);
  const close = () => dialogRef.current?.close();
  const label = format(t.addLabel, { title });

  return (
    <>
      {variant === "icon" ? (
        <button
          type="button"
          onClick={show}
          aria-label={label}
          title={label}
          className="inline-flex size-11 items-center justify-center rounded-full bg-paper/90 text-ink shadow-sm backdrop-blur transition-colors duration-200 ease-gallery hover:bg-paper"
        >
          <FramePlus className="size-[1.15rem]" />
        </button>
      ) : (
        <button
          type="button"
          onClick={show}
          className={buttonStyles({ variant: "secondary" })}
        >
          <FramePlus className="size-[1.15rem]" />
          {t.addToExhibition}
          <span className="sr-only">{` (${title})`}</span>
        </button>
      )}

      <dialog
        ref={dialogRef}
        aria-labelledby={open ? headingId : undefined}
        className="m-auto w-[min(92vw,30rem)] rounded-sm bg-paper p-0 text-ink shadow-2xl backdrop:bg-ink/50"
      >
        {open ? (
          <PickerContents
            artworkId={artworkId}
            title={title}
            headingId={headingId}
            onClose={close}
          />
        ) : null}
      </dialog>
    </>
  );
}

function PickerContents({
  artworkId,
  title,
  headingId,
  onClose,
}: {
  artworkId: number;
  title: string;
  headingId: string;
  onClose: () => void;
}) {
  const { dict } = useI18n();
  const t = dict.exhibitions;
  const collection = useCollection();
  const inputId = useId();
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [name, setName] = useState("");

  const explain = (result: WriteResult<unknown>, onOk: () => string) => {
    if (result.ok) {
      setError("");
      setStatus(onOk());
      return;
    }
    setStatus("");
    setError(
      result.reason === "limit"
        ? format(t.limitItems, { max: MAX_EXHIBITION_ITEMS })
        : result.reason === "storage"
          ? dict.favorite.storage
          : t.nameRequired,
    );
  };

  const toggle = (
    exhibitionId: string,
    exhibitionTitle: string,
    checked: boolean,
  ) => {
    if (checked) {
      explain(exhibitionActions.addWork(exhibitionId, artworkId), () =>
        format(t.added, { title: exhibitionTitle }),
      );
    } else {
      explain(exhibitionActions.removeWorks(exhibitionId, artworkId), () =>
        format(t.removed, { title: exhibitionTitle }),
      );
    }
  };

  const createAndAdd = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const created = exhibitionActions.create(name);
    if (!created.ok) {
      setStatus("");
      setError(
        created.reason === "limit"
          ? format(t.limitExhibitions, { max: MAX_EXHIBITIONS })
          : created.reason === "storage"
            ? dict.favorite.storage
            : t.nameRequired,
      );
      return;
    }
    explain(exhibitionActions.addWork(created.value.id, artworkId), () =>
      format(t.added, { title: created.value.title }),
    );
    setName("");
  };

  return (
    <>
      <div className="flex items-start justify-between gap-4 border-b border-line px-6 pt-6 pb-4">
        <div className="min-w-0">
          <h2 id={headingId} className="font-serif text-2xl">
            {t.pickerTitle}
          </h2>
          <p lang="en" className="mt-1 truncate font-serif text-muted italic">
            {title}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={t.done}
          className="-mt-1 -mr-2 inline-flex size-11 shrink-0 items-center justify-center rounded-full hover:bg-ink/5"
        >
          <X className="size-4" />
        </button>
      </div>

      <div className="max-h-[50svh] overflow-y-auto px-6 py-4">
        {collection.exhibitions.length === 0 ? (
          <p className="text-sm text-muted">{t.pickerEmpty}</p>
        ) : (
          <fieldset>
            <legend className="sr-only">{t.pickerTitle}</legend>
            <ul className="space-y-1">
              {collection.exhibitions.map((exhibition) => {
                const checked = exhibition.artworkIds.includes(artworkId);
                return (
                  <li key={exhibition.id}>
                    <label className="flex min-h-11 cursor-pointer items-center gap-3 rounded-sm px-2 hover:bg-ink/5">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(event) =>
                          toggle(
                            exhibition.id,
                            exhibition.title,
                            event.target.checked,
                          )
                        }
                        className="size-4 accent-[var(--color-ink)]"
                      />
                      <span className="min-w-0 flex-1 truncate">
                        {exhibition.title}
                      </span>
                      <span className="shrink-0 text-xs text-muted">
                        {exhibition.artworkIds.length === 1
                          ? t.countOne
                          : format(t.countOther, {
                              count: exhibition.artworkIds.length,
                            })}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          </fieldset>
        )}
      </div>

      <form
        onSubmit={createAndAdd}
        className="flex flex-col gap-2 border-t border-line px-6 py-4"
      >
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
            className="min-h-11 min-w-0 flex-1 rounded-sm border border-ink/25 bg-transparent px-3 text-sm placeholder:text-muted focus:border-ink focus:outline-none focus-visible:outline-2"
          />
          <Button type="submit" variant="secondary" size="sm">
            {t.createAndAdd}
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between gap-4 border-t border-line px-6 py-4">
        <div className="min-h-5 text-sm">
          <p role="status" className="text-muted">
            {status}
          </p>
          {error ? (
            <p role="alert" className="text-accent-deep">
              {error}
            </p>
          ) : null}
        </div>
        <Button size="sm" onClick={onClose}>
          {t.done}
        </Button>
      </div>
    </>
  );
}
