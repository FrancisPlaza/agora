import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

interface SizeOpts {
  w?: number;
  h?: number;
}

/**
 * Returns a 1-hour signed URL for the topic-art object, with optional
 * thumbnail transform. Production / hosted Supabase honours the `transform`
 * params; local dev's bundled imgproxy is stopped by default in this setup,
 * so the transform is a no-op locally and the original image is served.
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
      .createSignedUrl(path, 3600, {
        transform:
          opts.w || opts.h
            ? { width: opts.w, height: opts.h, resize: "cover" }
            : undefined,
      });

    if (error || !data?.signedUrl) return null;
    return data.signedUrl;
  },
);
