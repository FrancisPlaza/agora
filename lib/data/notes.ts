import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export interface MyNote {
  topic_id: number;
  body: string;
  visibility: "private" | "class";
  updated_at: string;
}

export interface ClassNote {
  id: string;
  topic_id: number;
  body: string;
  updated_at: string;
  author: { id: string; full_name: string };
}

interface ClassNoteRow {
  id: string;
  topic_id: number;
  body: string;
  updated_at: string;
  author: { id: string; full_name: string } | null;
}

/** Current user's note for the topic, or `null`. RLS scopes to self. */
export const getMyNote = cache(
  async (topicId: number): Promise<MyNote | null> => {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;

    const { data, error } = await supabase
      .from("notes")
      .select("topic_id, body, visibility, updated_at")
      .eq("voter_id", user.id)
      .eq("topic_id", topicId)
      .maybeSingle();

    if (error || !data) return null;
    return data;
  },
);

/**
 * All `visibility = 'class'` notes for the topic, joined to the author's
 * profile. RLS allows approved voters to read these.
 */
export const getClassNotes = cache(
  async (topicId: number): Promise<ClassNote[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .select("id, topic_id, body, updated_at, author:profiles!voter_id(id, full_name)")
      .eq("topic_id", topicId)
      .eq("visibility", "class")
      .order("updated_at", { ascending: false });

    if (error || !data) return [];
    return (data as ClassNoteRow[])
      .filter((n): n is ClassNoteRow & { author: { id: string; full_name: string } } => n.author !== null)
      // Empty/whitespace-only shared notes shouldn't surface to the class.
      // The new server gate in setNoteVisibility prevents new ones; this
      // filter handles any historical rows that slipped through.
      .filter((n) => n.body.trim() !== "")
      .map((n) => ({
        id: n.id,
        topic_id: n.topic_id,
        body: n.body,
        updated_at: n.updated_at,
        author: n.author,
      }));
  },
);

/** Topic IDs the current user has authored a note on (any visibility). */
export const getMyNotedTopics = cache(async (): Promise<number[]> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("notes")
    .select("topic_id")
    .eq("voter_id", user.id);

  if (error || !data) return [];
  return data.map((r) => r.topic_id);
});
