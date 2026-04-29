"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import {
  countSentences,
  fileExtensionForStorage,
  isAcceptedArtFile,
  isPdf,
} from "@/lib/validation";

const MIN_SENTENCES = 5;
const MAX_SENTENCES = 7;
const MAX_TITLE = 200;
const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

/**
 * Single action handles both first-publish and metadata-only edits. If
 * `file` is missing or empty, only `art_title` and `art_explanation`
 * update — no storage ops, `art_image_path` and `art_uploaded_at` left
 * alone. Storage delete-then-upload runs only when a new file is provided
 * so changing PDF → image doesn't leave a stale `.preview.png` behind.
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
  const previewEntry = formData.get("pdfPreview");

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

    const fileIsPdf = isPdf({
      type: fileEntry.type,
      name: fileEntry.name,
      size: fileEntry.size,
    });

    let previewBlob: Blob | null = null;
    if (fileIsPdf) {
      if (!(previewEntry instanceof Blob) || previewEntry.size === 0) {
        return {
          error:
            "PDF preview missing. Try selecting the file again — preview generation runs in your browser.",
        };
      }
      if (previewEntry.size > MAX_PREVIEW_BYTES) {
        return { error: "PDF preview is too large." };
      }
      previewBlob = previewEntry;
    }

    // Wipe any prior files under this topic's prefix so PDF → image
    // (or vice versa) doesn't leave a stale preview / original behind.
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

    if (previewBlob) {
      const { error: previewError } = await supabase.storage
        .from("presentations")
        .upload(`${newPath}.preview.png`, previewBlob, {
          contentType: "image/png",
          upsert: true,
        });
      if (previewError) {
        return {
          error: `Failed to upload PDF preview: ${previewError.message}`,
        };
      }
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
