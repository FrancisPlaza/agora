"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export interface ChipItem {
  id: string;
  label: string;
  count?: number;
}

interface ChipsProps {
  items: ChipItem[];
  /** Search-param key driving the active chip. */
  paramKey: string;
  /** Chip id treated as the default when the param is absent. */
  defaultId?: string;
}

/**
 * URL-driven filter chips. Active chip uses the prototype's filled-with-shadow
 * treatment. State lives in the search params so the page can stay
 * server-rendered.
 */
export function Chips({ items, paramKey, defaultId }: ChipsProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? defaultId ?? items[0]?.id;

  return (
    <div className="flex flex-wrap items-center gap-1">
      {items.map((it) => {
        const active = it.id === current;
        const next = new URLSearchParams(params);
        if (defaultId && it.id === defaultId) {
          next.delete(paramKey);
        } else {
          next.set(paramKey, it.id);
        }
        const href = next.toString() ? `${pathname}?${next.toString()}` : pathname;
        return (
          <Link
            key={it.id}
            href={href}
            scroll={false}
            className={[
              "px-2.5 py-1.5 rounded text-[13px] cursor-pointer border transition-colors duration-100",
              active
                ? "bg-white text-text border-line shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)]"
                : "bg-transparent text-text-2 border-transparent hover:bg-surface-alt",
            ].join(" ")}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className="text-text-2 ml-1.5">{it.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
