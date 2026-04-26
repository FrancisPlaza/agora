"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";
import { tally, Ballot, Topic } from "@/lib/irv";

/**
 * Run the sequential IRV tally. Admin only. Reads all submitted ballots
 * via service_role, computes results, and writes to tally_results.
 * Idempotent — clears prior results before writing.
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

  // Verify admin
  const { data: profile } = await service
    .from("profiles")
    .select("is_admin, status")
    .eq("id", user.id)
    .single();

  if (!profile || profile.status !== "approved" || !profile.is_admin) {
    return { error: "Admin access required" };
  }

  // Fetch all topics
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

  // Fetch all submitted ballots with their rankings
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

  // Fetch all rankings for submitted ballots
  const ballotIds = ballotsData.map((b) => b.id);
  const { data: rankingsData, error: rankingsError } = await service
    .from("rankings")
    .select("ballot_id, topic_id, rank")
    .in("ballot_id", ballotIds);

  if (rankingsError) {
    return { error: `Failed to fetch rankings: ${rankingsError.message}` };
  }

  // Build ballot objects
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

  // Run tally
  const result = tally(ballots, topics, 5);

  // Clear existing results and write new ones in sequence
  await service.from("tally_results").delete().gte("run_num", 1);

  for (const run of result.runs) {
    const lastRound = run.rounds[run.rounds.length - 1];
    const { error: writeError } = await service.from("tally_results").insert({
      run_num: run.position,
      winner_topic_id: run.winner,
      rounds: JSON.parse(JSON.stringify(run.rounds)),
      total_ballots: result.totalBallots,
      exhausted: lastRound?.exhausted ?? 0,
    });

    if (writeError) {
      return { error: `Failed to write tally result for run ${run.position}: ${writeError.message}` };
    }
  }

  // Update voting_state
  await service
    .from("voting_state")
    .update({ tally_run_at: new Date().toISOString() })
    .eq("id", 1);

  // Audit log
  await service.from("audit_log").insert({
    actor_id: user.id,
    action: "run_tally",
    target_type: "system",
    target_id: null,
    meta: {
      total_ballots: result.totalBallots,
      winners: result.runs.map((r) => r.winner),
    },
  });

  return {};
}
