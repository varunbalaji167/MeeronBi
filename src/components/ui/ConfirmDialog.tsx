"use client";

import { useEffect, useId, useRef, type ReactNode } from "react";
import { AlertTriangle } from "lucide-react";
import Button from "./Button";

interface Props {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Styles the icon and confirm button as destructive (red) vs. neutral (brand color). */
  danger?: boolean;
  loading?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** Extra content (e.g. an optional note field) rendered between the message and the buttons. */
  children?: ReactNode;
}

/** Styled replacement for window.confirm(); focuses cancel on open and closes on Escape. */
export default function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  danger,
  loading,
  onConfirm,
  onCancel,
  children,
}: Props) {
  const titleId = useId();
  const messageId = useId();
  const cancelRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    cancelRef.current?.focus();

    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !loading) onCancel();
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4"
      onClick={loading ? undefined : onCancel}
      role="alertdialog"
      aria-modal="true"
      aria-labelledby={titleId}
      aria-describedby={messageId}
    >
      <div className="panel w-full max-w-sm" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <span
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full ${
              danger ? "bg-rose-50 text-rose-600" : "bg-brand-50 text-brand-600"
            }`}
            aria-hidden="true"
          >
            <AlertTriangle className="h-5 w-5" />
          </span>
          <div>
            <h3 id={titleId} className="font-semibold text-ink">
              {title}
            </h3>
            <p id={messageId} className="mt-1 text-sm text-ink-soft">
              {message}
            </p>
          </div>
        </div>
        {children && <div className="mt-3">{children}</div>}
        <div className="mt-5 flex justify-end gap-2">
          <Button
            ref={cancelRef}
            variant="outline"
            onClick={onCancel}
            disabledReason={loading ? "Please wait" : undefined}
          >
            {cancelLabel}
          </Button>
          <Button variant={danger ? "danger" : "primary"} onClick={onConfirm} loading={loading}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
