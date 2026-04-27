import type { ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type BadgeTone =
  | "neutral"
  | "violet"
  | "amber"
  | "success"
  | "danger"
  | "navy";

interface BadgeProps {
  tone?: BadgeTone;
  icon?: IconName;
  children: ReactNode;
}

const TONE_CLASSES: Record<BadgeTone, string> = {
  neutral: "bg-surface-alt text-text-2 border border-line",
  violet: "bg-violet-100 text-violet-600 border border-transparent",
  amber: "bg-amber-50 text-amber border border-transparent",
  success: "bg-[#E1F2EA] text-success border border-transparent",
  danger: "bg-[#FCEBE8] text-danger border border-transparent",
  navy: "bg-[#E5ECF4] text-navy border border-transparent",
};

export function Badge({ tone = "neutral", icon, children }: BadgeProps) {
  return (
    <span
      className={[
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium leading-none whitespace-nowrap",
        TONE_CLASSES[tone],
      ].join(" ")}
    >
      {icon ? <Icon name={icon} size={11} /> : null}
      {children}
    </span>
  );
}
