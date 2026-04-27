import type { ReactNode } from "react";
import { TopNav } from "@/components/nav/top-nav";
import { BottomNav } from "@/components/nav/bottom-nav";
import { requireApproved } from "@/lib/auth";

export default async function AuthedLayout({
  children,
}: {
  children: ReactNode;
}) {
  const profile = await requireApproved();

  return (
    <div className="min-h-dvh flex flex-col bg-surface-alt">
      <TopNav fullName={profile.full_name} isAdmin={profile.is_admin} />
      <main className="flex-1 min-h-0 overflow-auto">{children}</main>
      <BottomNav isAdmin={profile.is_admin} />
    </div>
  );
}
