"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

export interface TabItem {
  id: string;
  label: string;
  count?: number;
}

interface TabsProps {
  items: TabItem[];
  /** Search-param key driving the active tab. */
  paramKey: string;
  /** Tab id treated as the default when the param is absent. */
  defaultId?: string;
}

/**
 * URL-driven tab strip. Active tab gets a violet underline. State lives in
 * the search params so server components downstream can render the correct
 * panel without a client roundtrip.
 */
export function Tabs({ items, paramKey, defaultId }: TabsProps) {
  const pathname = usePathname();
  const params = useSearchParams();
  const current = params.get(paramKey) ?? defaultId ?? items[0]?.id;

  return (
    <div className="flex gap-0.5 border-b border-line">
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
              "px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors duration-100",
              active
                ? "text-violet-600 border-violet"
                : "text-text-2 border-transparent hover:text-text",
            ].join(" ")}
          >
            {it.label}
            {typeof it.count === "number" ? (
              <span className="text-text-2 ml-1.5 font-normal">{it.count}</span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
