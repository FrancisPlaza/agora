interface AvatarProps {
  name: string;
  size?: number;
}

export function Avatar({ name, size = 28 }: AvatarProps) {
  const initials =
    (name || "?")
      .split(/\s+/)
      .slice(0, 2)
      .map((s) => s[0] ?? "")
      .join("")
      .toUpperCase() || "?";

  // Deterministic hue from the name so avatars are stable across renders.
  const hue =
    (name || "").split("").reduce((a, c) => a + c.charCodeAt(0), 0) % 360;

  return (
    <span
      className="inline-flex items-center justify-center rounded-full font-semibold text-white shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: Math.round(size * 0.42),
        background: `linear-gradient(135deg, oklch(0.55 0.12 ${hue}), oklch(0.30 0.08 ${(hue + 40) % 360}))`,
      }}
    >
      {initials}
    </span>
  );
}
