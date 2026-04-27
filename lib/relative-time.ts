/**
 * Format a past timestamp as a short relative phrase. Used for note
 * timestamps in the topic-detail class notes list.
 *
 *   < 60s         → "just now"
 *   < 60m         → "Nm ago"
 *   < 24h         → "Nh ago"
 *   yesterday     → "yesterday"
 *   same year     → "3 May"
 *   prior year    → "3 May 2025"
 */
export function formatRelative(input: string | Date, now: Date = new Date()): string {
  const then = typeof input === "string" ? new Date(input) : input;
  const diffMs = now.getTime() - then.getTime();
  const sec = Math.floor(diffMs / 1000);

  if (sec < 60) return "just now";

  const min = Math.floor(sec / 60);
  if (min < 60) return `${min}m ago`;

  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;

  // Same calendar day check via local midnight
  const startOfThen = new Date(
    then.getFullYear(),
    then.getMonth(),
    then.getDate(),
  );
  const startOfNow = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const dayDiff = Math.round(
    (startOfNow.getTime() - startOfThen.getTime()) / 86400000,
  );
  if (dayDiff === 1) return "yesterday";

  const sameYear = then.getFullYear() === now.getFullYear();
  return then.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    ...(sameYear ? {} : { year: "numeric" }),
  });
}
