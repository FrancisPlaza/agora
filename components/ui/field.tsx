import type { ReactNode } from "react";

interface FieldProps {
  label?: ReactNode;
  hint?: ReactNode;
  error?: ReactNode;
  htmlFor?: string;
  children: ReactNode;
}

export function Field({ label, hint, error, htmlFor, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {label ? (
        <label htmlFor={htmlFor} className="text-[13px] font-medium text-text">
          {label}
        </label>
      ) : null}
      {children}
      {error ? (
        <div className="text-xs text-danger">{error}</div>
      ) : hint ? (
        <div className="text-xs text-text-2">{hint}</div>
      ) : null}
    </div>
  );
}
