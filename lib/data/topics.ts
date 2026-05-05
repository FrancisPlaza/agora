import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type TopicRow = Database["public"]["Tables"]["topics"]["Row"];

export type TopicState = "unassigned" | "assigned" | "presented" | "published";

export interface TopicView extends TopicRow {
  state: TopicState;
  presenter: { id: string; full_name: string } | null;
  class_note_count: number;
}

/**
 * Topic lifecycle state derived from the row's identity columns.
 *
 * Per the May 2026 policy change, art is shared with the gallery as
 * soon as the presenter uploads — the oral presentation no longer
 * gates visibility. So `published` fires on `art_uploaded_at` alone,
 * regardless of `presented_at`. `presented` is now narrow: oral done
 * but no art yet (uncommon, since the upload usually precedes the
 * talk). The dashboard's filter chips and per-card status badges
 * track this naming.
 */
function deriveState(t: TopicRow): TopicState {
  if (!t.presenter_voter_id) return "unassigned";
  if (t.art_uploaded_at) return "published";
  if (t.presented_at) return "presented";
  return "assigned";
}

interface TopicWithPresenter extends TopicRow {
  presenter: { id: string; full_name: string } | null;
}

/** Fetch every topic, presenter info embedded, with class-note counts merged in. */
export const getAllTopics = cache(async (): Promise<TopicView[]> => {
  const supabase = await createClient();

  const [topicsResult, countsResult] = await Promise.all([
    supabase
      .from("topics")
      .select("*, presenter:profiles!presenter_voter_id(id, full_name)")
      .order("order_num"),
    supabase
      .from("notes")
      .select("topic_id")
      .eq("visibility", "class"),
  ]);

  if (topicsResult.error || !topicsResult.data) return [];

  const counts = new Map<number, number>();
  for (const row of countsResult.data ?? []) {
    counts.set(row.topic_id, (counts.get(row.topic_id) ?? 0) + 1);
  }

  return (topicsResult.data as TopicWithPresenter[]).map((t) => ({
    ...t,
    state: deriveState(t),
    presenter: t.presenter,
    class_note_count: counts.get(t.id) ?? 0,
  }));
});

/** Fetch a single topic by id, or `null` if not found / not visible. */
export const getTopic = cache(async (id: number): Promise<TopicView | null> => {
  const supabase = await createClient();

  const [topicResult, countResult] = await Promise.all([
    supabase
      .from("topics")
      .select("*, presenter:profiles!presenter_voter_id(id, full_name)")
      .eq("id", id)
      .maybeSingle(),
    supabase
      .from("notes")
      .select("id", { count: "exact", head: true })
      .eq("topic_id", id)
      .eq("visibility", "class"),
  ]);

  if (topicResult.error || !topicResult.data) return null;

  const t = topicResult.data as TopicWithPresenter;
  return {
    ...t,
    state: deriveState(t),
    presenter: t.presenter,
    class_note_count: countResult.count ?? 0,
  };
});

/**
 * Returns the current user's assigned topic (the one they're presenting),
 * or `null`. Suggested in the Phase 2 hand-off notes; `class_note_count`
 * is computed in Phase 6 (the admin topics page wants accurate counts
 * everywhere — also benefits the profile page).
 */
export const getMyTopic = cache(async (): Promise<TopicView | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data, error } = await supabase
    .from("topics")
    .select("*, presenter:profiles!presenter_voter_id(id, full_name)")
    .eq("presenter_voter_id", user.id)
    .maybeSingle();

  if (error || !data) return null;

  const t = data as TopicWithPresenter;

  const { count } = await supabase
    .from("notes")
    .select("id", { count: "exact", head: true })
    .eq("topic_id", t.id)
    .eq("visibility", "class");

  return {
    ...t,
    state: deriveState(t),
    presenter: t.presenter,
    class_note_count: count ?? 0,
  };
});
