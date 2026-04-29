"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { tally, Ballot, Topic } from "@/lib/irv";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Not authenticated",
  ADMIN_REQUIRED: "Admin access required",
  POLLS_NOT_LOCKED: "Polls must be closed before running the tally.",
};

/**
 * Run the sequential IRV tally. Admin only.
 *
 * Reads ballots and rankings via service_role — that's the legitimate
 * escape hatch, since admins can't read other voters' rankings via RLS
 * and the tally needs them all.
 *
 * Computes IRV in TypeScript, then delegates the writes (clear cache,
 * insert results, bump voting_state, audit) to the `write_tally_results`
 * Postgres function. The function locks `voting_state` FOR UPDATE so
 * concurrent admin invocations serialise.
 */
export async function runTally(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated" };
  }

  const service = createServiceClient();

  // Verify admin (also enforced inside write_tally_results, but we want
  // to fail fast before doing the cross-user reads).
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved" || !profile.is_admin) {
    return { error: "Admin access required" };
  }

  // Cross-user reads — RLS would hide other voters' rankings, so this
  // is the one place service_role is genuinely required.
  const { data: topicsData, error: topicsError } = await service
    .from("topics")
    .select("id, order_num")
    .order("order_num");

  if (topicsError || !topicsData) {
    return { error: `Failed to fetch topics: ${topicsError?.message}` };
  }

  const topics: Topic[] = topicsData.map((t) => ({
    id: t.id,
    orderNum: t.order_num,
  }));

  const { data: ballotsData, error: ballotsError } = await service
    .from("ballots")
    .select("id, voter_id")
    .not("submitted_at", "is", null);

  if (ballotsError || !ballotsData) {
    return { error: `Failed to fetch ballots: ${ballotsError?.message}` };
  }

  if (ballotsData.length === 0) {
    return { error: "No submitted ballots to tally" };
  }

  const ballotIds = ballotsData.map((b) => b.id);
  const { data: rankingsData, error: rankingsError } = await service
    .from("rankings")
    .select("ballot_id, topic_id, rank")
    .in("ballot_id", ballotIds);

  if (rankingsError) {
    return { error: `Failed to fetch rankings: ${rankingsError.message}` };
  }

  const rankingsByBallot = new Map<string, Array<{ topicId: number; rank: number }>>();
  for (const r of rankingsData ?? []) {
    const arr = rankingsByBallot.get(r.ballot_id) ?? [];
    arr.push({ topicId: r.topic_id, rank: r.rank });
    rankingsByBallot.set(r.ballot_id, arr);
  }

  const ballots: Ballot[] = ballotsData.map((b) => ({
    voterId: b.voter_id,
    rankings: (rankingsByBallot.get(b.id) ?? []).sort((a, b) => a.rank - b.rank),
  }));

  const result = tally(ballots, topics, 5, new Date().toISOString());

  // Shape for the SQL function: snake_case keys per run, with the
  // ballot's `exhausted` count taken from the final round of each run.
  const p_results = result.runs.map((run) => {
    const lastRound = run.rounds[run.rounds.length - 1];
    return {
      run_num: run.position,
      winner_topic_id: run.winner,
      rounds: run.rounds,
      exhausted: lastRound?.exhausted ?? 0,
    };
  });

  const { error: writeError } = await supabase.rpc("write_tally_results", {
    p_results,
    p_total_ballots: result.totalBallots,
  } as never);

  if (writeError) {
    const code = writeError.message.trim();
    return {
      error:
        ERROR_MESSAGES[code] ??
        `Failed to write tally results: ${writeError.message}`,
    };
  }

  return {};
}
