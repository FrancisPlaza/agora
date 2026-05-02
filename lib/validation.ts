/**
 * Approximate sentence count: terminal punctuation followed by whitespace
 * or end-of-string. Won't perfectly handle "e.g." or "Mr. Smith" — used as
 * a soft guide on the form, not a hard gate, and the same algorithm runs
 * server-side so behaviour stays consistent.
 */
export function countSentences(text: string): number {
  const trimmed = text.trim();
  if (!trimmed) return 0;
  const matches = trimmed.match(/[.!?]+(?=\s|$)/g);
  return matches ? matches.length : 0;
}

interface AcceptedArtInput {
  type: string;
  name: string;
  size: number;
}

export type AcceptedArtCheck =
  | { ok: true }
  | { ok: false; reason: string };

const MAX_BYTES = 3 * 1024 * 1024; // 3 MB — fits Vercel's 4.5 MB request body cap with FormData overhead.

const ACCEPTED_MIME = new Set([
  "image/jpeg",
  "image/jpg",
  "image/png",
  "image/gif",
  "image/webp",
]);

const ACCEPTED_EXT = new Set([
  "jpg",
  "jpeg",
  "png",
  "gif",
  "webp",
]);

function fileExtension(name: string): string {
  const dot = name.lastIndexOf(".");
  if (dot < 0) return "";
  return name.slice(dot + 1).toLowerCase();
}

/**
 * Accept JPG / PNG / GIF / WEBP, ≤ 3 MB.
 *
 * Both MIME and extension are checked — browsers report inconsistently
 * for some formats (especially when files arrive with no MIME header
 * via drag-drop or paste). Either matching path is sufficient.
 */
export function isAcceptedArtFile(file: AcceptedArtInput): AcceptedArtCheck {
  if (file.size <= 0) {
    return { ok: false, reason: "File is empty." };
  }
  if (file.size > MAX_BYTES) {
    return { ok: false, reason: "File is over 3 MB." };
  }

  const ext = fileExtension(file.name);
  const mimeOk = ACCEPTED_MIME.has(file.type.toLowerCase());
  const extOk = ext.length > 0 && ACCEPTED_EXT.has(ext);

  if (!mimeOk && !extOk) {
    return {
      ok: false,
      reason: "File type not accepted. Use JPG, PNG, GIF, or WEBP.",
    };
  }

  return { ok: true };
}

/** Lowercase extension chosen for the storage path. Defaults to mime guess. */
export function fileExtensionForStorage(file: AcceptedArtInput): string {
  const ext = fileExtension(file.name);
  if (ext) return ext;
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/gif") return "gif";
  if (file.type === "image/webp") return "webp";
  return "bin";
}
