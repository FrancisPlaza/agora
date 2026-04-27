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
 * Returns a 1-hour signed URL for the topic-art thumbnail, with optional
 * thumbnail transform. Resolves PDFs to their `.preview.png` sibling via
 * `getThumbnailPath`, so dashboard / ranking / topic-detail thumbnails
 * Just Work for both file kinds.
 *
 * Production / hosted Supabase honours the `transform` params; local dev's
 * bundled imgproxy is stopped by default in this setup, so the transform
 * is a no-op locally and the original image is served at full size.
 *
 * Returns `null` if the object can't be read (RLS rejection, missing object,
 * etc.) so callers can fall back to the placeholder.
 */
export const getTopicArtUrl = cache(
  async (path: string | null, opts: SizeOpts = {}): Promise<string | null> => {
    if (!path) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("presentations")
      .createSignedUrl(getThumbnailPath(path), 3600, {
        transform:
          opts.w || opts.h
            ? { width: opts.w, height: opts.h, resize: "cover" }
            : undefined,
      });

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  },
);

/**
 * Returns a 1-hour signed URL for the *original* topic-art object (PDF or
 * image, whatever was uploaded), bypassing the thumbnail resolution. Not
 * surfaced anywhere in Phase 5 UI — held for a future "View original PDF"
 * link on the topic-detail page or the results display.
 */
export const getTopicOriginalUrl = cache(
  async (path: string | null): Promise<string | null> => {
    if (!path) return null;
    const supabase = await createClient();
    const { data, error } = await supabase.storage
      .from("presentations")
      .createSignedUrl(path, 3600);

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  },
);
