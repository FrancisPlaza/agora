import type { ReactNode } from "react";

export type BannerTone = "violet" | "amber" | "neutral" | "success";

interface StatusBannerProps {
  tone?: BannerTone;
  title: ReactNode;
  sub?: ReactNode;
  action?: ReactNode;
}

const TONE_CLASSES: Record<BannerTone, string> = {
  violet: "bg-violet-100 border-[#DEDBFF]",
  amber: "bg-amber-50 border-[#EBDBA8]",
  neutral: "bg-white border-line",
  success: "bg-[#E1F2EA] border-[#B7DCC6]",
};

export function StatusBanner({
  tone = "violet",
  title,
  sub,
  action,
}: StatusBannerProps) {
  return (
    <div
      className={[
        "rounded-lg border px-4 py-3.5 flex items-center gap-3",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-sm">{title}</div>
        {sub ? <div className="text-[13px] text-text-2 mt-0.5">{sub}</div> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
