"use client";

import { useEffect, useState, useTransition, type ReactNode } from "react";
import { Button, type ButtonKind } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  description?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  /** Tone for the confirm button. Default: 'primary'. */
  confirmKind?: ButtonKind;
  /** Server action invoked on confirm. Receives no args. */
  onConfirm: () => Promise<{ error?: string } | void>;
}

/**
 * Small modal for destructive / one-tap confirmations. Shares visual
 * language with the Phase 4 submit modal but doesn't refactor it (per
 * the Phase 6 brief — surgical additions only).
 */
export function ConfirmDialog({
  open,
  onClose,
  title,
  description,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  confirmKind = "primary",
  onConfirm,
}: ConfirmDialogProps) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isPending) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, isPending]);

  if (!open) return null;

  function handleConfirm() {
    setError(null);
    startTransition(async () => {
      const result = await onConfirm();
      if (result && "error" in result && result.error) {
        setError(result.error);
        return;
      }
      onClose();
    });
  }

  return (
    <div
      className="fixed inset-0 bg-[rgba(10,37,64,0.45)] z-50 flex items-center justify-center p-5"
      onClick={() => !isPending && onClose()}
    >
      <div
        className="bg-white rounded-lg shadow-[0_12px_32px_rgba(10,37,64,0.12),0_2px_8px_rgba(10,37,64,0.06)] w-full max-w-md p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="font-serif text-2xl font-semibold tracking-tight m-0 mb-2">
          {title}
        </h2>
        {description ? (
          <div className="text-text-2 text-[14px] m-0 mb-2">{description}</div>
        ) : null}
        {error ? (
          <p className="mt-3 text-[13px] text-danger m-0">{error}</p>
        ) : null}
        <div className="mt-5 flex justify-end gap-2">
          <Button kind="ghost" onClick={onClose} disabled={isPending}>
            {cancelLabel}
          </Button>
          <Button
            kind={confirmKind}
            onClick={handleConfirm}
            disabled={isPending}
          >
            {isPending ? "Working…" : confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  );
}
