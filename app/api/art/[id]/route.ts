import type { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

/**
 * Image proxy for topic artwork.
 *
 * Frontend asks for `/api/art/<topicId>?v=<art_uploaded_at>&w=<w>&h=<h>`.
 * We auth-check via Supabase RLS (the `presentations` bucket SELECT
 * policy gates approved voters), generate a short-lived signed URL
 * with the requested transform, fetch the bytes, stream them back
 * with a long-lived `private, immutable` Cache-Control.
 *
 * The cache-bust signal is the `?v=<art_uploaded_at>` query param.
 * When the presenter re-uploads, `art_uploaded_at` changes → the URL
 * changes → the browser fetches fresh. Until then the URL is stable
 * and the browser cache hits indefinitely on revisit.
 *
 * Edge runtime keeps cold-start minimal — a dashboard with 32 tiles
 * triggers up to 32 invocations on a fresh-cache visit.
 */

export const runtime = "edge";

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function GET(
  request: NextRequest,
  { params }: RouteContext,
): Promise<Response> {
  const { id: idStr } = await params;
  const id = Number(idStr);
  if (!Number.isFinite(id) || id < 1) {
    return new Response("Bad request", { status: 400 });
  }

  const url = new URL(request.url);
  const wRaw = url.searchParams.get("w");
  const hRaw = url.searchParams.get("h");
  const w = wRaw ? Number(wRaw) : null;
  const h = hRaw ? Number(hRaw) : null;

  const supabase = await createClient();

  // Topic lookup. Returns 404 cleanly when the topic doesn't exist
  // or has no uploaded art.
  const { data: topic, error: topicErr } = await supabase
    .from("topics")
    .select("art_image_path")
    .eq("id", id)
    .maybeSingle();
  if (topicErr || !topic?.art_image_path) {
    return new Response("Not found", { status: 404 });
  }

  // Resolve PDF previews (legacy) and generate a short-lived signed
  // URL with optional thumbnail transform. RLS denies for non-approved
  // viewers — surfaces as a signing error here.
  const rawPath = topic.art_image_path;
  const path = rawPath.toLowerCase().endsWith(".pdf")
    ? `${rawPath}.preview.png`
    : rawPath;

  const wantsTransform =
    (w !== null && Number.isFinite(w) && w > 0) ||
    (h !== null && Number.isFinite(h) && h > 0);
  const signedOpts = wantsTransform
    ? {
        transform: {
          width: w !== null && w > 0 ? w : undefined,
          height: h !== null && h > 0 ? h : undefined,
          resize: "cover" as const,
        },
      }
    : undefined;

  const { data: signed, error: signErr } = await supabase.storage
    .from("presentations")
    .createSignedUrl(path, 60, signedOpts);
  if (signErr || !signed?.signedUrl) {
    return new Response("Forbidden", { status: 403 });
  }

  const upstream = await fetch(signed.signedUrl);
  if (!upstream.ok || !upstream.body) {
    return new Response("Upstream error", {
      status: upstream.status || 502,
    });
  }

  const headers = new Headers();
  const contentType = upstream.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  // The URL embeds `?v=<art_uploaded_at>` as a cache-bust signal, so
  // any URL we serve refers to a specific upload's bytes — safe to
  // mark immutable. `private` keeps shared caches (CDNs) out; the
  // bytes are gated by the proxy's auth check.
  headers.set("cache-control", "private, max-age=31536000, immutable");

  return new Response(upstream.body, { status: 200, headers });
}
