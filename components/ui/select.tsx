import type { SelectHTMLAttributes } from "react";

const BASE =
  "w-full appearance-none rounded border border-line bg-white px-3 py-2.5 pr-8 text-sm text-text font-sans outline-none transition-[border-color,box-shadow] duration-100 focus:border-violet focus:shadow-[0_0_0_3px_rgba(99,91,255,0.15)]";

const CHEVRON =
  "url(\"data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 12 12'><path d='M3 4.5l3 3 3-3' stroke='%2364748B' fill='none' stroke-width='1.5' stroke-linecap='round'/></svg>\")";

export function Select({ className, children, style, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      className={[BASE, className ?? ""].filter(Boolean).join(" ")}
      style={{
        backgroundImage: CHEVRON,
        backgroundRepeat: "no-repeat",
        backgroundPosition: "right 10px center",
        ...style,
      }}
      {...rest}
    >
      {children}
    </select>
  );
}
