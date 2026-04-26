import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Icon, type IconName } from "./icon";

export type ButtonKind =
  | "primary"
  | "secondary"
  | "ghost"
  | "danger"
  | "solid-danger";

export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  kind?: ButtonKind;
  size?: ButtonSize;
  block?: boolean;
  icon?: IconName;
  children?: ReactNode;
}

const KIND_CLASSES: Record<ButtonKind, string> = {
  primary:
    "bg-violet text-white border-transparent shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:bg-violet-600",
  secondary:
    "bg-white text-text border-line shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)] hover:bg-[#FAFCFE] hover:border-[#CFD7E0]",
  ghost: "bg-transparent text-text border-transparent hover:bg-surface-alt",
  danger:
    "bg-white text-danger border-[#ECCFCB] hover:bg-[#FCF1EF]",
  "solid-danger":
    "bg-danger text-white border-transparent hover:bg-[#A82F23]",
};

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1.5 text-[13px]",
  md: "px-3.5 py-2.5 text-sm",
  lg: "px-4.5 py-3 text-[15px]",
};

export function Button({
  kind = "secondary",
  size = "md",
  block,
  icon,
  className,
  children,
  type = "button",
  ...rest
}: ButtonProps) {
  const classes = [
    "inline-flex items-center justify-center gap-2 rounded border font-medium leading-none whitespace-nowrap select-none cursor-pointer",
    "transition-colors duration-100 ease-out",
    "focus-visible:outline-2 focus-visible:outline-violet focus-visible:outline-offset-2",
    "disabled:opacity-55 disabled:cursor-not-allowed",
    KIND_CLASSES[kind],
    SIZE_CLASSES[size],
    block ? "w-full" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <button {...rest} type={type} className={classes}>
      {icon ? <Icon name={icon} /> : null}
      {children}
    </button>
  );
}
