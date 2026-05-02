import type { Metadata } from "next";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { AdminSubNav } from "./admin-subnav";

// Admin subtree uses a three-segment title: "<page> | Admin | Agora".
// The /admin home page falls through to `default` so the tab reads
// "Admin | Agora" without "Home".
export const metadata: Metadata = {
  title: {
    default: "Admin | Agora",
    template: "%s | Admin | Agora",
  },
};

export default async function AdminLayout({
  children,
}: {
  children: ReactNode;
}) {
  // Defensive backstop on the middleware admin gate.
  await requireAdmin();

  return (
    <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-4 md:py-6">
      <div className="flex items-center gap-2 mb-2">
        <Badge tone="navy" icon="shield">
          Beadle
        </Badge>
      </div>
      <div className="mb-5">
        <AdminSubNav />
      </div>
      {children}
    </div>
  );
}
