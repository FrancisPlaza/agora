import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PublicCard } from "@/components/public-card";
import { signOut } from "@/lib/actions/auth";
import { getCurrentProfile } from "@/lib/auth";

export const metadata: Metadata = { title: "Awaiting approval" };

export default async function AwaitingApproval() {
  const profile = await getCurrentProfile();

  return (
    <PublicCard title="Pending approval">
      <p className="text-text-2 mb-5">
        Your beadle will review shortly. You&rsquo;ll get an email when it&rsquo;s
        done — usually within the day.
      </p>
      {profile ? (
        <div className="flex gap-3 p-3.5 bg-surface-alt rounded items-center">
          <Avatar name={profile.full_name} size={32} />
          <div className="min-w-0">
            <div className="font-medium">{profile.full_name}</div>
            <div className="text-text-2 text-xs truncate">{profile.email}</div>
          </div>
        </div>
      ) : null}
      <div className="mt-5">
        <form action={signOut}>
          <Button kind="ghost" type="submit">
            Sign out
          </Button>
        </form>
      </div>
    </PublicCard>
  );
}
