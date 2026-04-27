"use client";

import type { ReactNode } from "react";

interface SwitchProps {
  on: boolean;
  onChange: (next: boolean) => void;
  label?: ReactNode;
  disabled?: boolean;
}

export function Switch({ on, onChange, label, disabled }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => !disabled && onChange(!on)}
      className="inline-flex items-center gap-2.5 cursor-pointer select-none disabled:opacity-55 disabled:cursor-not-allowed"
    >
      <span
        className={[
          "relative w-9 h-5 rounded-full transition-colors duration-150 ease-out flex-none",
          on ? "bg-violet" : "bg-[#CBD5E1]",
        ].join(" ")}
      >
        <span
          className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow-[0_1px_2px_rgba(0,0,0,0.18)] transition-transform duration-180 ease-[cubic-bezier(.2,.7,.2,1)]"
          style={{ transform: on ? "translateX(16px)" : "translateX(0)" }}
        />
      </span>
      {label ? <span className="text-[13px] text-text">{label}</span> : null}
    </button>
  );
}
