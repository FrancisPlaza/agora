"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { AgoraWordmark } from "@/components/ui/agora-wordmark";
import { Avatar } from "@/components/ui/avatar";

const VOTER_LINKS = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/vote", label: "Vote" },
  { href: "/profile", label: "Profile" },
] as const;

const ADMIN_LINK = { href: "/admin", label: "Admin" } as const;

interface TopNavProps {
  fullName: string;
  isAdmin?: boolean;
}

export function TopNav({ fullName, isAdmin }: TopNavProps) {
  const pathname = usePathname();
  const links = isAdmin
    ? [...VOTER_LINKS, ADMIN_LINK]
    : [...VOTER_LINKS];
  return (
    <nav className="hidden md:flex items-center gap-6 px-6 h-14 bg-white border-b border-line print:hidden">
      <Link href="/dashboard" className="shrink-0">
        <AgoraWordmark size={18} />
      </Link>
      <div className="flex gap-1 flex-1">
        {links.map((l) => {
          const active = pathname === l.href || pathname.startsWith(l.href + "/");
          return (
            <Link
              key={l.href}
              href={l.href}
              className={[
                "px-3 py-2 rounded text-[13px] font-medium transition-colors duration-100",
                active
                  ? "text-violet-600 bg-violet-100"
                  : "text-text-2 hover:bg-surface-alt hover:text-text",
              ].join(" ")}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
      <Link
        href="/profile"
        className="flex items-center gap-2.5 text-[13px] text-text-2 hover:text-text"
      >
        <span>{fullName}</span>
        <Avatar name={fullName} />
      </Link>
    </nav>
  );
}
