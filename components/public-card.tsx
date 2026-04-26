import type { ReactNode } from "react";
import Link from "next/link";
import { AgoraWordmark } from "./ui/agora-wordmark";
import { Card } from "./ui/card";

interface PublicCardProps {
  title: string;
  children: ReactNode;
  footer?: ReactNode;
}

const HERO_BG: React.CSSProperties = {
  background: [
    "radial-gradient(ellipse 80% 60% at 15% 20%, rgba(99,91,255,0.10), transparent 60%)",
    "radial-gradient(ellipse 70% 60% at 85% 30%, rgba(184,134,11,0.07), transparent 60%)",
    "radial-gradient(ellipse 100% 80% at 50% 100%, rgba(10,37,64,0.06), transparent 60%)",
    "linear-gradient(180deg, #FFFFFF, #F6F9FC)",
  ].join(", "),
};

export function PublicCard({ title, children, footer }: PublicCardProps) {
  return (
    <div
      className="min-h-dvh flex items-center justify-center p-6"
      style={HERO_BG}
    >
      <div className="w-full max-w-md">
        <div className="text-center mb-6">
          <Link href="/" className="inline-block">
            <AgoraWordmark size={20} />
          </Link>
        </div>
        <Card className="p-7">
          <h2 className="font-serif text-2xl font-semibold tracking-tight mb-1.5">
            {title}
          </h2>
          {children}
        </Card>
        {footer ? (
          <div className="text-center mt-4 text-[13px] text-text-2">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  );
}
