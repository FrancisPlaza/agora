import type { SVGProps } from "react";

export type IconName =
  | "home"
  | "vote"
  | "user"
  | "shield"
  | "search"
  | "lock"
  | "unlock"
  | "drag"
  | "check"
  | "x"
  | "plus"
  | "upload"
  | "file"
  | "calendar"
  | "clock"
  | "chev-r"
  | "chev-l"
  | "chev-d"
  | "arrow-r"
  | "note"
  | "users"
  | "external"
  | "dots"
  | "trophy"
  | "filter"
  | "info"
  | "log-out"
  | "mail";

interface IconProps extends Omit<SVGProps<SVGSVGElement>, "name" | "stroke"> {
  name: IconName;
  size?: number;
  strokeWidth?: number;
}

export function Icon({ name, size = 16, strokeWidth = 1.6, ...rest }: IconProps) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...rest,
  };
  switch (name) {
    case "home":
      return <svg {...common}><path d="M3 11l9-8 9 8M5 10v10h14V10" /></svg>;
    case "vote":
      return <svg {...common}><path d="M9 11l3 3 7-7M3 12a9 9 0 1018 0 9 9 0 00-18 0z" /></svg>;
    case "user":
      return <svg {...common}><circle cx="12" cy="8" r="4" /><path d="M4 21c0-4 4-7 8-7s8 3 8 7" /></svg>;
    case "shield":
      return <svg {...common}><path d="M12 3l8 3v6c0 5-3.5 8.5-8 9-4.5-.5-8-4-8-9V6l8-3z" /></svg>;
    case "search":
      return <svg {...common}><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.5-4.5" /></svg>;
    case "lock":
      return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 018 0v3" /></svg>;
    case "unlock":
      return <svg {...common}><rect x="5" y="11" width="14" height="9" rx="2" /><path d="M8 11V8a4 4 0 017-2.5" /></svg>;
    case "drag":
      return <svg {...common}><circle cx="9" cy="6" r="1.2" /><circle cx="9" cy="12" r="1.2" /><circle cx="9" cy="18" r="1.2" /><circle cx="15" cy="6" r="1.2" /><circle cx="15" cy="12" r="1.2" /><circle cx="15" cy="18" r="1.2" /></svg>;
    case "check":
      return <svg {...common}><path d="M5 12l4 4 10-10" /></svg>;
    case "x":
      return <svg {...common}><path d="M6 6l12 12M18 6L6 18" /></svg>;
    case "plus":
      return <svg {...common}><path d="M12 5v14M5 12h14" /></svg>;
    case "upload":
      return <svg {...common}><path d="M12 16V4M6 10l6-6 6 6M4 20h16" /></svg>;
    case "file":
      return <svg {...common}><path d="M14 3H6a2 2 0 00-2 2v14a2 2 0 002 2h12a2 2 0 002-2V9l-6-6z" /><path d="M14 3v6h6" /></svg>;
    case "calendar":
      return <svg {...common}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></svg>;
    case "clock":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
    case "chev-r":
      return <svg {...common}><path d="M9 6l6 6-6 6" /></svg>;
    case "chev-l":
      return <svg {...common}><path d="M15 6l-6 6 6 6" /></svg>;
    case "chev-d":
      return <svg {...common}><path d="M6 9l6 6 6-6" /></svg>;
    case "arrow-r":
      return <svg {...common}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
    case "note":
      return <svg {...common}><path d="M5 4h11l3 3v13a1 1 0 01-1 1H5a1 1 0 01-1-1V5a1 1 0 011-1z" /><path d="M8 9h8M8 13h8M8 17h5" /></svg>;
    case "users":
      return <svg {...common}><circle cx="9" cy="8" r="3" /><path d="M3 20c0-3 3-5 6-5s6 2 6 5" /><circle cx="17" cy="9" r="2.5" /><path d="M15 20c0-2 2-3.5 4-3.5s2 1 2 3.5" /></svg>;
    case "external":
      return <svg {...common}><path d="M14 4h6v6M20 4l-9 9M19 14v5a1 1 0 01-1 1H5a1 1 0 01-1-1V6a1 1 0 011-1h5" /></svg>;
    case "dots":
      return <svg {...common}><circle cx="6" cy="12" r="1.2" /><circle cx="12" cy="12" r="1.2" /><circle cx="18" cy="12" r="1.2" /></svg>;
    case "trophy":
      return <svg {...common}><path d="M8 21h8M12 17v4M6 4h12v4a6 6 0 01-12 0V4z" /><path d="M6 6H3v2a3 3 0 003 3M18 6h3v2a3 3 0 01-3 3" /></svg>;
    case "filter":
      return <svg {...common}><path d="M4 5h16l-6 8v6l-4-2v-4L4 5z" /></svg>;
    case "info":
      return <svg {...common}><circle cx="12" cy="12" r="9" /><path d="M12 8v.01M11 12h1v5h1" /></svg>;
    case "log-out":
      return <svg {...common}><path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
    case "mail":
      return <svg {...common}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></svg>;
    default:
      return null;
  }
}
