import { cache } from "react";

interface SizeOpts {
  w?: number;
  h?: number;
  /**
   * The topic's `art_uploaded_at` timestamp, if available. Becomes the
   * `?v=` cache-bust signal in the proxy URL — stable per upload, so
   * the browser caches indefinitely until art is replaced.
   */
  version?: string | null;
}

/** Topic id is encoded as the first path segment, e.g. "5/artwork.png". */
function topicIdFromPath(artImagePath: string): number | null {
  const segment = artImagePath.split("/")[0];
  const n = Number(segment);
  return Number.isFinite(n) && n >= 1 ? n : null;
}

function buildProxyUrl(
  topicId: number,
  opts: SizeOpts,
): string {
  const params = new URLSearchParams();
  if (opts.version) params.set("v", opts.version);
  if (opts.w) params.set("w", String(opts.w));
  if (opts.h) params.set("h", String(opts.h));
  const qs = params.toString();
  return qs ? `/api/art/${topicId}?${qs}` : `/api/art/${topicId}`;
}

/**
 * Returns a stable proxy URL for the topic-art thumbnail, with
 * optional thumbnail transform. The actual bytes flow through
 * `app/api/art/[id]/route.ts`, which auth-gates via Supabase RLS,
 * generates a short-lived signed URL, fetches the bytes, and
 * streams them back with a long-lived `Cache-Control`.
 *
 * Pass `version: topic.art_uploaded_at` so the URL changes when the
 * presenter re-uploads — without it, the browser would keep serving
 * the old bytes from cache after a replace. With it, every upload
 * gets a fresh URL and the browser fetches once.
 *
 * Returns `null` if `path` is null or doesn't encode a valid topic
 * id in its first segment. Callers fall back to the placeholder.
 *
 * The function is React-`cache()`-wrapped so multiple calls with
 * the same arguments inside a single render dedupe; it's an
 * effectively-synchronous URL builder, but stays async to keep the
 * existing call signature.
 */
export const getTopicArtUrl = cache(
  async (path: string | null, opts: SizeOpts = {}): Promise<string | null> => {
    if (!path) return null;
    const topicId = topicIdFromPath(path);
    if (topicId === null) return null;
    return buildProxyUrl(topicId, opts);
  },
);

/**
 * Returns a stable proxy URL for the *original* topic-art object,
 * bypassing the thumbnail transform. Used by the artwork lightbox
 * for full-resolution display.
 */
export const getTopicOriginalUrl = cache(
  async (
    path: string | null,
    version: string | null = null,
  ): Promise<string | null> => {
    if (!path) return null;
    const topicId = topicIdFromPath(path);
    if (topicId === null) return null;
    return buildProxyUrl(topicId, { version });
  },
);

/**
 * Legacy helper — kept for any read path that needs the
 * thumbnail-vs-original branch on raw storage paths. The proxy
 * route applies the same `.pdf` → `.preview.png` resolution
 * internally, so most callers don't need this directly.
 */
export function getThumbnailPath(artImagePath: string): string {
  return artImagePath.toLowerCase().endsWith(".pdf")
    ? `${artImagePath}.preview.png`
    : artImagePath;
}
