"use server";

import { createClient, createServiceClient } from "@/lib/supabase/server";

/**
 * Submit a ballot. Validates rankings, writes them, and locks the ballot.
 */
export async function submitBallot(
  rankings: Array<{ topicId: number; rank: number }>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser();

  if (authError || !user) {
    return { error: "Not authenticated" };
  }

  const service = createServiceClient();

  // Verify voter has an assigned topic (voting eligibility)
  const { data: topic } = await service
    .from("topics")
    .select("id")
    .eq("presenter_voter_id", user.id)
    .maybeSingle();

  if (!topic) {
    return { error: "You are not eligible to vote — no assigned topic" };
  }

  // Validate rankings
  if (rankings.length === 0) {
    return { error: "Ballot must have at least one ranking" };
  }

  const ranks = rankings.map((r) => r.rank);
  const topicIds = rankings.map((r) => r.topicId);

  // No duplicate ranks
  if (new Set(ranks).size !== ranks.length) {
    return { error: "Duplicate ranks not allowed" };
  }

  // No duplicate topics
  if (new Set(topicIds).size !== topicIds.length) {
    return { error: "Duplicate topics not allowed" };
  }

  // All topic_ids must exist
  const { data: validTopics } = await service
    .from("topics")
    .select("id")
    .in("id", topicIds);

  if (!validTopics || validTopics.length !== topicIds.length) {
    return { error: "One or more topic IDs are invalid" };
  }

  // Get or create ballot
  let { data: ballot } = await service
    .from("ballots")
    .select("id, submitted_at, locked_at")
    .eq("voter_id", user.id)
    .maybeSingle();

  if (ballot?.submitted_at || ballot?.locked_at) {
    return { error: "Ballot is already locked — contact a beadle to unlock" };
  }

  if (!ballot) {
    const { data: newBallot, error: createError } = await service
      .from("ballots")
      .insert({ voter_id: user.id })
      .select("id")
      .single();

    if (createError || !newBallot) {
      return { error: `Failed to create ballot: ${createError?.message}` };
    }
    ballot = { ...newBallot, submitted_at: null, locked_at: null };
  }

  // Delete existing rankings and insert new ones
  await service.from("rankings").delete().eq("ballot_id", ballot.id);

  const { error: insertError } = await service.from("rankings").insert(
    rankings.map((r) => ({
      ballot_id: ballot.id,
      topic_id: r.topicId,
      rank: r.rank,
    })),
  );

  if (insertError) {
    return { error: `Failed to save rankings: ${insertError.message}` };
  }

  // Lock the ballot
  const { error: submitError } = await service
    .from("ballots")
    .update({ submitted_at: new Date().toISOString() })
    .eq("id", ballot.id);

  if (submitError) {
    return { error: `Failed to submit ballot: ${submitError.message}` };
  }

  // Audit log
  await service.from("audit_log").insert({
    actor_id: user.id,
    action: "submit_ballot",
    target_type: "voter",
    target_id: user.id,
    meta: { ranking_count: rankings.length },
  });

  return {};
}
