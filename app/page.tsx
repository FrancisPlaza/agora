import Link from "next/link";
import { AgoraWordmark } from "@/components/ui/agora-wordmark";
import { Button } from "@/components/ui/button";

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
    <main className="min-h-dvh flex flex-col" style={HERO_BG}>
      <header className="px-8 py-5 flex items-center justify-between">
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

      <div className="flex-1 flex items-center justify-center px-6 py-10">
        <div className="max-w-3xl text-center">
          <div className="text-[11px] font-mono uppercase tracking-[0.12em] text-text-2 mb-6">
            San Beda College Alabang · JDN101
          </div>
          <h1 className="font-serif font-semibold tracking-tight leading-[1.05] m-0 text-[clamp(40px,6vw,64px)]">
            Ranked-choice voting
            <br />
            for Philosophy of Law.
          </h1>
          <p className="text-[17px] text-text-2 leading-relaxed mt-5 max-w-xl mx-auto">
            One philosopher. One piece of art. Five minutes at the front of the
            room. Agora is the gallery you build together — and the ballot you
            settle it with.
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
          <div className="flex justify-center gap-6 mt-16 text-text-2 text-[13px] flex-wrap">
            <div>32 topics</div>
            <div aria-hidden>·</div>
            <div>Sequential IRV</div>
            <div aria-hidden>·</div>
            <div>Beadle-mediated</div>
          </div>
        </div>
      </div>

      <footer className="border-t border-line px-8 py-5 text-text-2 text-xs flex justify-between flex-wrap gap-2">
        <span>Built for the JDN101 cohort, A.Y. 2025–26</span>
      </footer>
    </main>
  );
}
