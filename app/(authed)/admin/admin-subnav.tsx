"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin", label: "Home" },
  { href: "/admin/approvals", label: "Approvals" },
  { href: "/admin/voters", label: "Voters" },
  { href: "/admin/topics", label: "Topics" },
  { href: "/admin/voting", label: "Voting" },
] as const;

export function AdminSubNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-0.5 border-b border-line overflow-x-auto">
      {TABS.map((t) => {
        const active =
          t.href === "/admin"
            ? pathname === "/admin"
            : pathname === t.href || pathname.startsWith(t.href + "/");
        return (
          <Link
            key={t.href}
            href={t.href}
            className={[
              "px-3.5 py-2.5 text-[13px] font-medium border-b-2 -mb-px transition-colors duration-100 whitespace-nowrap",
              active
                ? "text-violet-600 border-violet"
                : "text-text-2 border-transparent hover:text-text",
            ].join(" ")}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
