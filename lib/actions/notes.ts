"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface UpsertNoteInput {
  topicId: number;
  body: string;
}

/**
 * Create or update the current user's note body for a topic. Empty body is
 * allowed — lets the user clear a note without losing the visibility
 * setting. RLS (`notes_self_write`) gates authorisation; no service role.
 *
 * On insert, `visibility` defaults to `private` (column default). On update,
 * `visibility` is intentionally not in the payload, so it stays unchanged.
 */
export async function upsertNote({
  topicId,
  body,
}: UpsertNoteInput): Promise<{ error?: string }> {
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic." };
  }
  if (body.length > 5000) {
    return { error: "Note is too long." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  const { error } = await supabase.from("notes").upsert(
    {
      voter_id: user.id,
      topic_id: topicId,
      body,
    },
    { onConflict: "voter_id,topic_id", ignoreDuplicates: false },
  );

  if (error) return { error: error.message };
  revalidatePath(`/topic/${topicId}`);
  revalidatePath("/dashboard");
  return {};
}

interface SetVisibilityInput {
  topicId: number;
  visibility: "private" | "class";
}

/**
 * Flip a note's visibility. If flipping to `class`, refuse when the
 * existing body is empty/whitespace — empty shared notes used to surface
 * as blank cards on every classmate's "Class notes" tab. The note-editor
 * client disables the switch already; this is the defensive backstop.
 *
 * `body` is intentionally absent from the upsert payload so that on
 * conflict the existing body stays put. On insert (visibility=private,
 * no row yet) the column default (empty string) applies.
 */
export async function setNoteVisibility({
  topicId,
  visibility,
}: SetVisibilityInput): Promise<{ error?: string }> {
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic." };
  }
  if (visibility !== "private" && visibility !== "class") {
    return { error: "Invalid visibility." };
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { error: "Not authenticated." };

  if (visibility === "class") {
    const { data: existing } = await supabase
      .from("notes")
      .select("body")
      .eq("voter_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();
    if (!existing || existing.body.trim() === "") {
      return { error: "Write a note before sharing it with the class." };
    }
  }

  const { error } = await supabase.from("notes").upsert(
    {
      voter_id: user.id,
      topic_id: topicId,
      visibility,
    },
    { onConflict: "voter_id,topic_id", ignoreDuplicates: false },
  );

  if (error) return { error: error.message };
  revalidatePath(`/topic/${topicId}`);
  revalidatePath("/dashboard");
  return {};
}
