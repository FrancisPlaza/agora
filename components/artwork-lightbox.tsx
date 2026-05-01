"use client";

import { useEffect, useState, type ReactNode } from "react";
import { Icon } from "@/components/ui/icon";

interface ArtworkLightboxProps {
  src: string;
  alt: string;
  /**
   * The hero content (the wrapped <img> + its aspect-ratio /
   * border / radius styling). Receives a click target via the
   * surrounding <button>; the icon overlay positions absolutely
   * over this content.
   */
  children: ReactNode;
}

/**
 * Click-anywhere-on-artwork lightbox. Mirrors the ConfirmDialog
 * pattern (Esc handler via useEffect cleanup, click-outside dismiss);
 * no focus-trap library — the trigger and close buttons are
 * naturally focusable, Escape and click-outside cover dismissal.
 *
 * Used only when the topic has a real signed artwork URL; the
 * gradient fallback / unpublished placeholder hero stays a plain
 * <div> on the page side.
 */
export function ArtworkLightbox({ src, alt, children }: ArtworkLightboxProps) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={`Open ${alt} at full size`}
        className="block w-full text-left cursor-zoom-in relative"
      >
        {children}
        <span
          aria-hidden
          className="absolute top-3 right-3 inline-flex items-center justify-center w-7 h-7 rounded-full bg-black/40 text-white backdrop-blur-sm hover:bg-black/55 transition-colors"
        >
          <Icon name="expand" size={14} />
        </span>
      </button>
      {open ? (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label="Artwork preview"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={alt}
            className="max-w-[90vw] max-h-[90vh] object-contain shadow-[0_20px_60px_rgba(0,0,0,0.5)]"
            onClick={(e) => e.stopPropagation()}
          />
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close"
            className="absolute top-4 right-4 inline-flex items-center justify-center w-9 h-9 rounded-full bg-white/10 text-white backdrop-blur-sm hover:bg-white/20 transition-colors"
          >
            <Icon name="x" size={18} />
          </button>
        </div>
      ) : null}
    </>
  );
}
