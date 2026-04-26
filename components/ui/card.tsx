import type { HTMLAttributes, ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  pad?: boolean;
  flat?: boolean;
  children: ReactNode;
}

export function Card({ pad, flat, className, children, ...rest }: CardProps) {
  const classes = [
    "bg-white border border-line rounded-lg",
    flat ? "" : "shadow-[0_1px_3px_rgba(10,37,64,0.06),0_1px_2px_rgba(10,37,64,0.04)]",
    pad ? "p-5" : "",
    className ?? "",
  ]
    .filter(Boolean)
    .join(" ");
  return (
    <div className={classes} {...rest}>
      {children}
    </div>
  );
}
