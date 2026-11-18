"use client";

import { useEffect, useId, useRef } from "react";
import { Button } from "./button";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  cancelLabel: string;
  onConfirm: () => void;
  onCancel: () => void;
}

/**
 * A modal confirmation for destructive actions, on the native <dialog>: focus stays inside,
 * Escape cancels, and focus returns to whatever opened it. Cancel comes first, so it is the
 * button that receives focus; deleting always takes a deliberate second step.
 */
export function ConfirmDialog({
  open,
  title,
  body,
  confirmLabel,
  cancelLabel,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const bodyId = useId();

  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      role="alertdialog"
      aria-labelledby={titleId}
      aria-describedby={bodyId}
      // Escape: stay controlled by the parent rather than letting the browser close it.
      onCancel={(event) => {
        event.preventDefault();
        onCancel();
      }}
      className="m-auto w-[min(92vw,28rem)] rounded-sm bg-paper p-6 text-ink shadow-2xl backdrop:bg-ink/50 sm:p-8"
    >
      <h2 id={titleId} className="font-serif text-2xl leading-snug">
        {title}
      </h2>
      <p id={bodyId} className="mt-3 text-sm leading-6 text-muted">
        {body}
      </p>
      <div className="mt-8 flex flex-wrap justify-end gap-3">
        <Button variant="secondary" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          onClick={onConfirm}
          className="bg-accent-deep hover:bg-[#62301f]"
        >
          {confirmLabel}
        </Button>
      </div>
    </dialog>
  );
}
