/**
 * Format a past timestamp as a short relative phrase. Used for note
 * timestamps in the topic-detail class notes list and the audit log
 * on the admin home.
 *
 *   < 60s         → "just now"
 *   < 60m         → "Nm ago"
 *   < 24h         → "Nh ago"
 *   yesterday     → "yesterday"
 *   same year     → "3 May"
 *   prior year    → "3 May 2025"
 *
 * "Yesterday" / "same year" branches and the absolute-date fallback
 * all read in Manila local time, regardless of where this code runs
 * (the function may execute in a Vercel server component pinned to
 * UTC). Without explicit Manila resolution, late-evening Manila
 * timestamps would be misclassified by a day on the server.
 */

const TZ = "Asia/Manila";

interface ManilaParts {
  year: number;
  month: number;
  day: number;
}

const MANILA_PARTS_FORMATTER = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

function manilaParts(d: Date): ManilaParts {
  // en-CA renders as "YYYY-MM-DD".
  const [y, m, day] = MANILA_PARTS_FORMATTER.format(d).split("-").map(Number);
  return { year: y, month: m, day };
}

function manilaDayDiff(a: Date, b: Date): number {
  const pa = manilaParts(a);
  const pb = manilaParts(b);
  const ta = Date.UTC(pa.year, pa.month - 1, pa.day);
  const tb = Date.UTC(pb.year, pb.month - 1, pb.day);
  return Math.round((ta - tb) / 86400000);
}

export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const then = typeof input === "string" ? new Date(input) : input;
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);

  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  const dayDiff = manilaDayDiff(now, then);
  if (dayDiff === 1) return "yesterday";

  const sameYear = manilaParts(then).year === manilaParts(now).year;
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: TZ,
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
