import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { requireAdmin } from "@/lib/auth";
import { AdminSubNav } from "./admin-subnav";

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
