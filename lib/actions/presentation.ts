"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  countSentences,
  fileExtensionForStorage,
  isAcceptedArtFile,
} from "@/lib/validation";

const MIN_SENTENCES = 5;
const MAX_SENTENCES = 7;
const MAX_TITLE = 200;

/**
 * Single action handles both first-publish and metadata-only edits. If
 * `file` is missing or empty, only `art_title` and `art_explanation`
 * update — no storage ops, `art_image_path` and `art_uploaded_at` left
 * alone. Storage delete-then-upload runs only when a new file is provided
 * so replacing artwork doesn't leave stale objects under the topic prefix.
 *
 * Auth, presenter-match, and `presented`/`published` state checks happen
 * up front for friendly errors. RLS (`topics_presenter_update_art`) plus
 * the `presentations` storage policies enforce the same rules at the DB
 * boundary regardless.
 *
 * On success: `revalidatePath` the dashboard + topic detail + this page,
 * then `redirect('/dashboard')` (per Phase 5 brief — no
 * `window.location.assign`).
 */
export async function uploadPresentation(
  formData: FormData,
): Promise<{ error?: string }> {
  const topicIdRaw = String(formData.get("topicId") ?? "");
  const topicId = Number(topicIdRaw);
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic." };
  }

  const artTitle = String(formData.get("artTitle") ?? "").trim();
  const artExplanation = String(formData.get("artExplanation") ?? "").trim();
  const fileEntry = formData.get("file");

  // ── Auth + topic load ────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select(
      "id, presenter_voter_id, presented_at, art_uploaded_at, art_image_path",
    )
    .eq("id", topicId)
    .maybeSingle();

  if (topicError || !topic) return { error: "Topic not found." };
  if (topic.presenter_voter_id !== user.id) {
    return { error: "Only the assigned presenter can upload." };
  }
  // Phase 7.6: assigned topics may also upload (pre-presented). The
  // storage write policy enforces presenter-match without requiring
  // presented_at; the read policy hides the file from non-presenters
  // until the beadle marks the topic presented.

  // ── Metadata validation ──────────────────────────────────────────────
  if (!artTitle) return { error: "Art title is required." };
  if (artTitle.length > MAX_TITLE) {
    return { error: "Art title is too long." };
  }
  if (!artExplanation) {
    return { error: "Explanation is required." };
  }
  const sentences = countSentences(artExplanation);
  if (sentences < MIN_SENTENCES || sentences > MAX_SENTENCES) {
    return {
      error: `Explanation should be ${MIN_SENTENCES}–${MAX_SENTENCES} sentences (got ${sentences}).`,
    };
  }

  // ── File path branch ────────────────────────────────────────────────
  const isFirstPublish = !topic.art_uploaded_at;
  const hasNewFile =
    fileEntry instanceof File && fileEntry.size > 0;

  if (isFirstPublish && !hasNewFile) {
    return { error: "Please choose an artwork file." };
  }

  let nextArtImagePath = topic.art_image_path;

  if (hasNewFile && fileEntry instanceof File) {
    const fileCheck = isAcceptedArtFile({
      type: fileEntry.type,
      name: fileEntry.name,
      size: fileEntry.size,
    });
    if (!fileCheck.ok) return { error: fileCheck.reason };

    const ext = fileExtensionForStorage({
      type: fileEntry.type,
      name: fileEntry.name,
      size: fileEntry.size,
    });
    const newPath = `${topicId}/artwork.${ext}`;

    // Wipe any prior files under this topic's prefix so a re-upload
    // doesn't leave a stale original behind (and clears any legacy
    // PDF + .preview.png from before PDFs were dropped as a type).
    const { data: existing } = await supabase.storage
      .from("presentations")
      .list(`${topicId}/`);

    if (existing && existing.length > 0) {
      const paths = existing.map((o) => `${topicId}/${o.name}`);
      const { error: removeError } = await supabase.storage
        .from("presentations")
        .remove(paths);
      if (removeError) {
        return { error: `Failed to clear old artwork: ${removeError.message}` };
      }
    }

    const { error: uploadError } = await supabase.storage
      .from("presentations")
      .upload(newPath, fileEntry, {
        contentType: fileEntry.type || "application/octet-stream",
        upsert: true,
      });
    if (uploadError) {
      return { error: `Failed to upload artwork: ${uploadError.message}` };
    }

    nextArtImagePath = newPath;
  }

  // ── Topic row update ────────────────────────────────────────────────
  const update: {
    art_title: string;
    art_explanation: string;
    art_image_path?: string;
    art_uploaded_at?: string;
  } = {
    art_title: artTitle,
    art_explanation: artExplanation,
  };
  if (hasNewFile && nextArtImagePath) {
    update.art_image_path = nextArtImagePath;
    update.art_uploaded_at = new Date().toISOString();
  }

  // .select("id") makes a silent RLS denial visible. Without the chain,
  // Postgres returns 0 rows affected with no error and the JS client
  // returns { error: null }, which used to produce a "successful" upload
  // that silently left art fields null (the Phase 7.6 → migration 0018
  // bug). The chain costs one row of one column.
  const { data: updatedRows, error: updateError } = await supabase
    .from("topics")
    .update(update)
    .eq("id", topicId)
    .select("id");

  if (updateError) {
    return { error: `Failed to update topic: ${updateError.message}` };
  }
  if (!updatedRows || updatedRows.length === 0) {
    // Best-effort orphan cleanup. The pre-write list+remove already
    // wiped any prior files, so anything under {topicId}/ now is what
    // we just uploaded. Edge case: if the topic was previously
    // published and a future RLS regression denies the row update mid-
    // flow, this leaves the DB row pointing at the prior path that we
    // already deleted. The user gets a clear error and a retry repaves
    // storage from the next pre-write list+remove.
    if (hasNewFile) {
      const { data: orphans } = await supabase.storage
        .from("presentations")
        .list(`${topicId}/`);
      if (orphans && orphans.length > 0) {
        await supabase.storage
          .from("presentations")
          .remove(orphans.map((o) => `${topicId}/${o.name}`));
      }
    }
    return {
      error:
        "Could not save your presentation — the topic row was not updated. " +
        "If this persists, ask a beadle to check your topic assignment.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/topic/${topicId}`);
  revalidatePath(`/topic/${topicId}/upload`);
  redirect("/dashboard");
}

/**
 * Clear the four art fields and delete every storage object under the
 * topic's prefix. Mirrors uploadPresentation's storage-wipe path. The
 * topic returns to its pre-upload state ("assigned" or "presented"
 * depending on presented_at). The presenter can re-upload after.
 *
 * The schema's published_requires_all_art constraint allows the
 * all-null state — it only fires when art_uploaded_at is set without
 * the other three fields. No migration needed.
 */
export async function removeArtwork(
  topicId: number,
): Promise<{ error?: string }> {
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { data: topic, error: topicError } = await supabase
    .from("topics")
    .select("id, presenter_voter_id, art_uploaded_at")
    .eq("id", topicId)
    .maybeSingle();

  if (topicError || !topic) return { error: "Topic not found." };
  if (topic.presenter_voter_id !== user.id) {
    return { error: "Only the assigned presenter can remove artwork." };
  }
  if (!topic.art_uploaded_at) {
    return { error: "No artwork to remove." };
  }

  // Wipe every object under {topicId}/. Mirrors the pre-write list+remove
  // in uploadPresentation so we don't strand legacy companion files
  // (e.g. older .preview.png siblings from before PDFs were dropped).
  const { data: existing } = await supabase.storage
    .from("presentations")
    .list(`${topicId}/`);

  if (existing && existing.length > 0) {
    const paths = existing.map((o) => `${topicId}/${o.name}`);
    const { error: removeError } = await supabase.storage
      .from("presentations")
      .remove(paths);
    if (removeError) {
      return {
        error: `Failed to remove storage objects: ${removeError.message}`,
      };
    }
  }

  // Same .select("id") trick as uploadPresentation — surfaces a silent
  // RLS denial as a real error rather than a "successful no-op".
  const { data: updatedRows, error: updateError } = await supabase
    .from("topics")
    .update({
      art_image_path: null,
      art_uploaded_at: null,
      art_title: null,
      art_explanation: null,
    })
    .eq("id", topicId)
    .select("id");

  if (updateError) {
    return { error: `Failed to clear artwork: ${updateError.message}` };
  }
  if (!updatedRows || updatedRows.length === 0) {
    return {
      error:
        "Could not clear your artwork — the topic row was not updated. " +
        "If this persists, ask a beadle to check your topic assignment.",
    };
  }

  revalidatePath("/dashboard");
  revalidatePath(`/topic/${topicId}`);
  revalidatePath(`/topic/${topicId}/upload`);
  redirect(`/topic/${topicId}`);
}
