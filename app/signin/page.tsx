import Link from "next/link";
import { PublicCard } from "@/components/public-card";
import { SignInForm } from "./form";

interface PageProps {
  searchParams: Promise<{ sent?: string; email?: string; error?: string }>;
}

function maskEmail(email: string): string {
  return email.replace(/(.).+(@.+)/, "$1•••$2");
}

export default async function SignIn({ searchParams }: PageProps) {
  const params = await searchParams;
  const sent = params.sent === "1";

  if (sent) {
    return (
      <PublicCard title="Check your inbox">
        <p className="text-text-2 mb-5">
          We sent a sign-in link to{" "}
          <b className="text-text">
            {params.email ? maskEmail(params.email) : "your inbox"}
          </b>
          . It expires in 15 minutes.
        </p>
        <p className="text-text-2 text-[13px]">
          Wrong email?{" "}
          <Link href="/signin" className="text-violet-600 hover:underline">
            Try again
          </Link>
          .
        </p>
      </PublicCard>
    );
  }

  return (
    <PublicCard
      title="Sign in"
      footer={
        <>
          New here?{" "}
          <Link href="/register" className="text-violet-600 hover:underline">
            Register
          </Link>
        </>
      }
    >
      <SignInForm initialError={params.error} />
    </PublicCard>
  );
}
