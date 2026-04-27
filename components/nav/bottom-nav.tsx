"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Icon, type IconName } from "@/components/ui/icon";

const VOTER_LINKS: Array<{ href: string; label: string; icon: IconName }> = [
  { href: "/dashboard", label: "Dashboard", icon: "home" },
  { href: "/vote", label: "Vote", icon: "vote" },
  { href: "/profile", label: "Profile", icon: "user" },
];

const ADMIN_LINK: { href: string; label: string; icon: IconName } = {
  href: "/admin",
  label: "Admin",
  icon: "shield",
};

interface BottomNavProps {
  isAdmin?: boolean;
}

export function BottomNav({ isAdmin }: BottomNavProps) {
  const pathname = usePathname();
  const links = isAdmin ? [...VOTER_LINKS, ADMIN_LINK] : [...VOTER_LINKS];
  return (
    <nav className="md:hidden sticky bottom-0 bg-white border-t border-line flex px-2 pt-1.5 pb-2.5 z-30">
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
