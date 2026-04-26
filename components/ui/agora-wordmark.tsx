interface AgoraWordmarkProps {
  size?: number;
  markOnly?: boolean;
}

export function AgoraMark({ size = 28 }: { size?: number }) {
  return (
    <span
      className="inline-flex items-center justify-center rounded-md bg-navy text-white font-serif font-semibold tracking-tight"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        letterSpacing: "-0.02em",
      }}
    >
      A
    </span>
  );
}

export function AgoraWordmark({ size = 22, markOnly = false }: AgoraWordmarkProps) {
  if (markOnly) return <AgoraMark size={size + 6} />;
  return (
    <span className="inline-flex items-center gap-2">
      <AgoraMark size={size + 6} />
      <span
        className="font-serif font-semibold text-navy"
        style={{ fontSize: size, letterSpacing: "-0.015em" }}
      >
        Agora
      </span>
    </span>
  );
}
