import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

export type VotingState = Database["public"]["Tables"]["voting_state"]["Row"];

export type PollsState = "not_open" | "open" | "closed";

export interface MyBallot {
  id: string;
  submitted_at: string | null;
  locked_at: string | null;
  rankings: Array<{ topicId: number; rank: number }>;
}

/**
 * Pure derivation of the polls state from the singleton config row + a
 * reference time. Order of checks matters:
 *
 *   1. closed   — polls_locked OR (deadline_at set AND now >= deadline_at)
 *   2. not_open — polls_open_at null OR now < polls_open_at
 *   3. open     — otherwise
 */
export function derivePollsState(
  vs: Pick<VotingState, "deadline_at" | "polls_open_at" | "polls_locked">,
  now: Date,
): PollsState {
  if (vs.polls_locked) return "closed";
  if (vs.deadline_at && now.getTime() >= new Date(vs.deadline_at).getTime()) {
    return "closed";
  }
  if (!vs.polls_open_at) return "not_open";
  if (now.getTime() < new Date(vs.polls_open_at).getTime()) return "not_open";
  return "open";
}

/** Singleton voting_state row. RLS allows approved voters to read it. */
export const getVotingState = cache(async (): Promise<VotingState | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("voting_state")
    .select("*")
    .eq("id", 1)
    .maybeSingle();
  if (error || !data) return null;
  return data;
});

/**
 * Current user's ballot row plus their rankings, ordered by rank ascending.
 * Returns `null` if no ballot exists yet (the user hasn't started ranking).
 */
export const getMyBallot = cache(async (): Promise<MyBallot | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: ballot } = await supabase
    .from("ballots")
    .select("id, submitted_at, locked_at")
    .eq("voter_id", user.id)
    .maybeSingle();

  if (!ballot) return null;

  const { data: rankings } = await supabase
    .from("rankings")
    .select("topic_id, rank")
    .eq("ballot_id", ballot.id)
    .order("rank", { ascending: true });

  return {
    id: ballot.id,
    submitted_at: ballot.submitted_at,
    locked_at: ballot.locked_at,
    rankings: (rankings ?? []).map((r) => ({
      topicId: r.topic_id,
      rank: r.rank,
    })),
  };
});
