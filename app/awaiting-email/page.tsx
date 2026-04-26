import { Button } from "@/components/ui/button";
import { Icon } from "@/components/ui/icon";
import { PublicCard } from "@/components/public-card";
import { signOut } from "@/lib/actions/auth";
import { getCurrentUser } from "@/lib/auth";
import { resendAction } from "./actions";

interface PageProps {
  searchParams: Promise<{ resent?: string; error?: string }>;
}

export default async function AwaitingEmail({ searchParams }: PageProps) {
  const params = await searchParams;
  // Right after register the user has no session yet (magic link not
  // clicked). Once they click it, they're signed in and may be back here
  // if their status is still pending_email — only then is resend/sign-out
  // meaningful.
  const user = await getCurrentUser();

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
      {user ? (
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
      ) : (
        <div className="mt-5 text-[13px] text-text-2">
          Didn&rsquo;t get the email?{" "}
          <a href="/signin" className="text-violet-600 hover:underline">
            Request a new link
          </a>
          .
        </div>
      )}
    </PublicCard>
  );
}
