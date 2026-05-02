import type { Metadata } from "next";
import Link from "next/link";
import { AgoraWordmark } from "@/components/ui/agora-wordmark";
import { Button } from "@/components/ui/button";
import { HeroAnimation } from "@/components/hero-animation";

// `absolute` bypasses the root layout's "%s | Agora" template, which
// would otherwise wrap this into "Agora · Where consensus happens |
// Agora". Authed users are redirected away from / by the middleware,
// so in practice this title is only seen by unauthenticated visitors.
export const metadata: Metadata = {
  title: { absolute: "Agora · Where consensus happens" },
};

const HERO_BG: React.CSSProperties = {
  background: [
    "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(99,91,255,0.10), transparent 60%)",
    "radial-gradient(ellipse 70% 60% at 85% 30%, rgba(184,134,11,0.07), transparent 60%)",
    "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(10,37,64,0.06), transparent 60%)",
    "linear-gradient(180deg, #FFFFFF, #F6F9FC)",
  ].join(", "),
};

export default function Landing() {
  return (
    <main className="relative min-h-dvh flex flex-col" style={HERO_BG}>
      <HeroAnimation />
      <header className="relative z-10 px-8 py-5 flex items-center justify-between">
        <AgoraWordmark size={20} />
        <div className="flex items-center gap-2">
          <Link href="/signin">
            <Button kind="ghost">Sign in</Button>
          </Link>
          <Link href="/register">
            <Button kind="primary">Register</Button>
          </Link>
        </div>
      </header>

      <div className="relative z-10 flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-3xl text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-text-2 mb-6">
            San Beda College Alabang School of Law · JDN101
          </div>
          <h1 className="font-serif font-semibold tracking-tight leading-[1.05] m-0 text-[clamp(40px,6vw,64px)]">
            Ranked-choice voting
            <br />
            for Philosophy of Law.
          </h1>
          <p className="text-[17px] text-text-2 leading-relaxed mt-5 max-w-xl mx-auto">
            One philosopher. One piece of art. Five minutes at the front of the
            class. Agora is the gallery where the class can deliberate
            democratically and visualise consensus together.
          </p>
          <div className="flex justify-center gap-2.5 mt-8 flex-wrap">
            <Link href="/register">
              <Button kind="primary" size="lg" icon="arrow-r">
                Create account
              </Button>
            </Link>
            <Link href="/signin">
              <Button kind="secondary" size="lg">
                I already have one
              </Button>
            </Link>
          </div>
        </div>
      </div>

      <footer className="relative z-10 border-t border-line px-8 py-5 text-text-2 text-xs flex justify-between flex-wrap gap-2">
        <span>Built with ❤️ by Francis Plaza.</span>
        <Provenance />
      </footer>
    </main>
  );
}

/**
 * Right-aligned source-and-commit line. Three render modes:
 *  - Both env vars present: "Source on GitHub · agora@<sha>" with both
 *    halves linking (repo home and the specific commit).
 *  - Only NEXT_PUBLIC_COMMIT_SHA: "agora@<sha>" plain text.
 *  - Neither: "agora@dev" (local dev fallback from next.config.ts).
 */
function Provenance() {
  const repo = process.env.NEXT_PUBLIC_REPO_URL ?? "";
  const sha = process.env.NEXT_PUBLIC_COMMIT_SHA ?? "dev";
  const shortSha = sha.slice(0, 7);
  const linkClass = "hover:text-text underline-offset-2 hover:underline";
  if (repo) {
    return (
      <span>
        <a href={repo} target="_blank" rel="noreferrer" className={linkClass}>
          Source on GitHub
        </a>
        {" · "}
        <a
          href={`${repo}/commit/${sha}`}
          target="_blank"
          rel="noreferrer"
          className={linkClass}
        >
          agora@{shortSha}
        </a>
      </span>
    );
  }
  return <span>agora@{shortSha}</span>;
}
