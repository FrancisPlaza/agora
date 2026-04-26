import type { InputHTMLAttributes } from "react";

const BASE =
  "w-full rounded border border-line bg-white px-3 py-2.5 text-sm text-text font-sans outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-text-3 focus:border-violet focus:shadow-[0_0_0_3px_rgba(99,91,255,0.15)] read-only:bg-surface-alt read-only:text-text-2";

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={[BASE, className ?? ""].filter(Boolean).join(" ")} {...rest} />;
}
