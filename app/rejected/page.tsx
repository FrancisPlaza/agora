import type { Metadata } from "next";
import { Button } from "@/components/ui/button";
import { PublicCard } from "@/components/public-card";
import { signOut } from "@/lib/actions/auth";

export const metadata: Metadata = { title: "Application rejected" };

function beadleLines(): string[] {
  const raw = process.env.NEXT_PUBLIC_BEADLE_CONTACT?.trim();
  if (!raw) return [];
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

export default function Rejected() {
  const lines = beadleLines();

  return (
    <PublicCard title="Account not approved">
      <p className="text-text-2 mb-4">
        Your beadle did not approve this registration. If you think it&rsquo;s a
        mistake, reach out below — usually it&rsquo;s a mismatched student ID.
      </p>
      <div className="bg-surface-alt rounded p-3.5 text-[13px]">
        <div className="font-medium mb-1">Contact your beadle</div>
        {lines.length > 0 ? (
          lines.map((line) => (
            <div key={line} className="text-text-2">
              {line}
            </div>
          ))
        ) : (
          <div className="text-text-2">
            Reach out to your class beadle directly.
          </div>
        )}
      </div>
      <div className="mt-5">
        <form action={signOut}>
          <Button kind="secondary" block type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </PublicCard>
  );
}
