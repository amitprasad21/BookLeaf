"use client";
// Confirmation on the native modal <dialog>: the browser traps focus, closes
// on Esc and returns focus to the control that opened it.
import { useEffect, useId, useRef, type ReactNode } from "react";
import { buttonClassName } from "./Button.js";

export interface ConfirmDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  /** Destructive or hard-to-undo actions get the danger style. */
  danger?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel,
  cancelLabel = "Cancel",
  danger = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const dialog = useRef<HTMLDialogElement>(null);
  const ids = useId();

  useEffect(() => {
    const element = dialog.current;
    if (!element) return;
    if (open && !element.open) element.showModal();
    if (!open && element.open) element.close();
  }, [open]);

  return (
    <dialog
      ref={dialog}
      className="bl-dialog"
      aria-labelledby={`${ids}-title`}
      aria-describedby={description ? `${ids}-description` : undefined}
      onCancel={(event) => {
        event.preventDefault(); // Esc: let the owner decide, so `open` stays the source of truth
        onCancel();
      }}
    >
      <h2 id={`${ids}-title`} className="bl-dialog__title">
        {title}
      </h2>
      {description ? (
        <div id={`${ids}-description`} className="bl-dialog__description">
          {description}
        </div>
      ) : null}
      <div className="bl-dialog__actions">
        <button type="button" className={buttonClassName()} onClick={onCancel}>
          {cancelLabel}
        </button>
        <button
          type="button"
          className={buttonClassName({ variant: danger ? "danger" : "primary" })}
          onClick={onConfirm}
        >
          {confirmLabel}
        </button>
      </div>
    </dialog>
  );
}
