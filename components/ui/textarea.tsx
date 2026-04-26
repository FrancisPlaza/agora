import type { TextareaHTMLAttributes } from "react";

const BASE =
  "w-full min-h-24 rounded border border-line bg-white px-3 py-2.5 text-sm leading-relaxed text-text font-sans outline-none transition-[border-color,box-shadow] duration-100 placeholder:text-text-3 focus:border-violet focus:shadow-[0_0_0_3px_rgba(99,91,255,0.15)] resize-y";

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea className={[BASE, className ?? ""].filter(Boolean).join(" ")} {...rest} />
  );
}
