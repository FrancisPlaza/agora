interface ArtPlaceholderProps {
  orderNum: number;
  philosopher: string;
  theme: string;
  artTitle?: string | null;
  showLabel?: boolean;
}

// Soft, subtly-saturated tints transcribed from src/data.jsx's TINTS array.
const TINTS = [
  { bg: "#E8EEF5", ink: "#1A2B47" },
  { bg: "#F3E8E1", ink: "#4A2C1F" },
  { bg: "#E6EFE8", ink: "#1F3A29" },
  { bg: "#F0E9F4", ink: "#3A2A4A" },
  { bg: "#F4EBDB", ink: "#4A3920" },
  { bg: "#E1ECEF", ink: "#1F3A42" },
  { bg: "#EFE4E4", ink: "#4A2424" },
  { bg: "#E8E8EE", ink: "#27293A" },
  { bg: "#EAF0E1", ink: "#2D3A1A" },
  { bg: "#F2E5EC", ink: "#4A203A" },
  { bg: "#E5E8F0", ink: "#202A47" },
  { bg: "#F4EFDF", ink: "#4A4220" },
];

/**
 * Deterministic SVG placeholder for unpublished topics, keyed off
 * order_num. Tint cycles through TINTS; line + circle composition
 * varies subtly by id so cards don't all look identical.
 */
export function ArtPlaceholder({
  orderNum,
  philosopher,
  theme,
  artTitle,
  showLabel = true,
}: ArtPlaceholderProps) {
  const t = TINTS[(orderNum - 1) % TINTS.length];
  const seed = orderNum;

  return (
    <div
      className="w-full h-full flex flex-col justify-between p-4 relative overflow-hidden"
      style={{ background: t.bg, color: t.ink }}
    >
      <svg
        className="absolute inset-0 opacity-[0.18]"
        viewBox="0 0 100 80"
        preserveAspectRatio="none"
        aria-hidden
      >
        {Array.from({ length: 8 }, (_, i) => (
          <line
            key={i}
            x1="0"
            y1={i * 10 + (seed % 5)}
            x2="100"
            y2={i * 10 + 5 + (seed % 5)}
            stroke={t.ink}
            strokeWidth="0.2"
          />
        ))}
        <circle
          cx={20 + ((seed * 7) % 50)}
          cy={20 + ((seed * 3) % 30)}
          r={8 + (seed % 4)}
          stroke={t.ink}
          strokeWidth="0.4"
          fill="none"
        />
      </svg>
      {showLabel ? (
        <>
          <div className="relative z-[1]">
            <div
              className="font-mono text-[11px] tabular-nums tracking-[0.04em]"
              style={{ color: t.ink, opacity: 0.6 }}
            >
              Nº {String(orderNum).padStart(2, "0")}
            </div>
          </div>
          <div className="relative z-[1]">
            <div className="font-serif text-[22px] font-semibold leading-[1.15] tracking-tight">
              {philosopher}
            </div>
            <div
              className="font-serif italic text-[13px] mt-1"
              style={{ color: t.ink, opacity: 0.7 }}
            >
              {artTitle ?? theme}
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
