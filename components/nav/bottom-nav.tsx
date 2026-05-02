"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

interface BottomNavProps {
  isAdmin?: boolean;
  hasTopic?: boolean;
  tallyDone?: boolean;
}

export function BottomNav({ isAdmin, hasTopic, tallyDone }: BottomNavProps) {
  const pathname = usePathname();
  const links: Array<{ href: string; label: string; icon: IconName }> = [
    { href: "/dashboard", label: "Dashboard", icon: "home" },
    ...(hasTopic ? [{ href: "/vote", label: "Vote", icon: "vote" as const }] : []),
    ...(tallyDone
      ? [{ href: "/results", label: "Results", icon: "trophy" as const }]
      : []),
    { href: "/profile", label: "Profile", icon: "user" },
    ...(isAdmin ? [{ href: "/admin", label: "Admin", icon: "shield" as const }] : []),
  ];
  return (
    <nav className="md:hidden sticky bottom-0 bg-white border-t border-line flex px-2 pt-1.5 pb-2.5 z-30 print:hidden">
      {links.map((l) => {
        const active = pathname === l.href || pathname.startsWith(l.href + "/");
        return (
          <Link
            key={l.href}
            href={l.href}
            className={[
              "flex-1 flex flex-col items-center gap-0.5 py-1.5 text-[11px]",
              active ? "text-violet-600" : "text-text-2",
            ].join(" ")}
          >
            <Icon name={l.icon} size={20} strokeWidth={1.7} />
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
