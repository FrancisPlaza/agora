import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

interface SizeOpts {
  w?: number;
  h?: number;
}

/**
 * For PDFs we store a `.preview.png` alongside the original (rendered
 * client-side at upload time) so thumbnails render fast everywhere. For
 * images, the path is unchanged.
 */
export function getThumbnailPath(artImagePath: string): string {
  return artImagePath.toLowerCase().endsWith(".pdf")
    ? `${artImagePath}.preview.png`
    : artImagePath;
}

/**
 * Returns a stable public URL for the topic-art thumbnail, with optional
 * thumbnail transform. Resolves PDFs to their `.preview.png` sibling via
 * `getThumbnailPath`, so dashboard / ranking / topic-detail thumbnails
 * Just Work for both file kinds.
 *
 * Migration 0028 made the `presentations` bucket public so URLs are
 * stable across requests — the browser caches images indefinitely
 * (subject to the storage Cache-Control header) instead of
 * refetching on every page load like it did with signed URLs (whose
 * JWT token changed per render).
 *
 * Public-bucket trade-off: anyone with the URL can fetch the file,
 * even without an Agora session. The artwork is already class-
 * visible (migration 0027), and the URL is non-guessable in
 * practice (path includes the topic id + filename), so the leakage
 * risk is small for a class gallery.
 *
 * Returns `null` only when the input path is null. Public-URL
 * construction is deterministic — no error path.
 */
export const getTopicArtUrl = cache(
  async (path: string | null, opts: SizeOpts = {}): Promise<string | null> => {
    if (!path) return null;
    const supabase = await createClient();
    const { data } = supabase.storage
      .from("presentations")
      .getPublicUrl(getThumbnailPath(path), {
        transform:
          opts.w || opts.h
            ? { width: opts.w, height: opts.h, resize: "cover" }
            : undefined,
      });
    return data.publicUrl;
  },
);

/**
 * Returns a stable public URL for the *original* topic-art object,
 * bypassing the thumbnail resolution. Used by the artwork lightbox
 * for full-resolution display.
 */
export const getTopicOriginalUrl = cache(
  async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const supabase = await createClient();
    const { data } = supabase.storage.from("presentations").getPublicUrl(path);
    return data.publicUrl;
  },
);
