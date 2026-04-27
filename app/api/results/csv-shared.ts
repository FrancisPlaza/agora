/**
 * RFC 4180 CSV escaping. Wraps any field containing comma, quote, CR
 * or LF in double quotes; doubles any internal quotes. Numbers and
 * booleans pass through.
 */
export function csvField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = String(value);
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

export function csvRow(values: unknown[]): string {
  return values.map(csvField).join(",");
}

/** Build a downloadable CSV Response with the right headers. */
export function csvResponse(filename: string, body: string): Response {
  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Same shape as the page uses; null when no tally yet. */
export function notFoundResponse(): Response {
  return new Response("Tally not yet computed.", { status: 404 });
}
