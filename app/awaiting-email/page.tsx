import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PublicCard } from "@/components/public-card";
import { signOut } from "@/lib/actions/auth";
import { resendAction } from "./actions";

interface PageProps {
  searchParams: Promise<{ resent?: string; error?: string }>;
}

export default async function AwaitingEmail({ searchParams }: PageProps) {
  const params = await searchParams;

  return (
    <PublicCard title="Confirm your email">
      <p className="text-text-2 mb-5">
        We sent a confirmation link to your school inbox. Open it on this device
        to finish.
      </p>
      <div className="bg-surface-alt rounded px-4 py-3.5 flex gap-3 items-center">
        <Icon name="info" size={18} />
        <div className="text-[13px]">
          Once confirmed, your beadle has up to 24 hours to approve.
        </div>
      </div>
      {params.resent ? (
        <div className="mt-4 text-[13px] text-success">
          New link sent. Check your inbox again.
        </div>
      ) : null}
      {params.error ? (
        <div className="mt-4 text-[13px] text-danger">{params.error}</div>
      ) : null}
      <div className="mt-5 flex justify-between gap-2">
        <form action={signOut}>
          <Button kind="ghost" type="submit">
            Sign out
          </Button>
        </form>
        <form action={resendAction}>
          <Button kind="secondary" type="submit">
            Resend link
          </Button>
        </form>
      </div>
    </PublicCard>
  );
}
