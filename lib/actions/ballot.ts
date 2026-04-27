"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { getMyBallot } from "@/lib/data/voting";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Not authenticated",
  NOT_ELIGIBLE: "You are not eligible to vote — no assigned topic",
  INVALID_RANKINGS: "Invalid rankings format",
  EMPTY_BALLOT: "Ballot must have at least one ranking",
  DUPLICATE_RANK: "Duplicate ranks not allowed",
  DUPLICATE_TOPIC: "Duplicate topics not allowed",
  INVALID_TOPIC: "One or more topic IDs are invalid",
  BALLOT_LOCKED: "Your ballot is locked — contact a beadle to unlock",
  POLLS_CLOSED: "Polls are closed — submission isn't possible",
  POLLS_NOT_OPEN: "Polls aren't open yet — try again once your beadle opens voting",
};

function rpcError(error: { message: string }): { error: string } {
  const code = error.message.trim();
  return {
    error: ERROR_MESSAGES[code] ?? `Failed to save ballot: ${error.message}`,
  };
}

/**
 * Submit a ballot. Delegates the entire write — validation, ranking
 * replacement, lock, audit — to the `submit_ballot` Postgres function.
 * RLS plus the function's own auth checks gate access; no service-role
 * client is used.
 */
export async function submitBallot(
  rankings: Array<{ topicId: number; rank: number }>,
): Promise<{ error?: string }> {
  const supabase = await createClient();

  // The `as never` cast works around a supabase-js v2.104 typing quirk:
  // the Args generic on `rpc<>` defaults to `never`, so a typed args object
  // fails the constraint check. Runtime is unaffected — Supabase still
  // JSON-encodes the payload as the function expects.
  const { error } = await supabase.rpc("submit_ballot", {
    p_rankings: rankings,
  } as never);

  if (error) return rpcError(error);
  return {};
}

/**
 * Save a draft ranking. Sibling to `submitBallot` but does not lock the
 * ballot or write to audit_log. Empty array is permitted (clears all
 * rankings without deleting the ballot row).
 */
export async function saveDraftRankings(
  rankings: Array<{ topicId: number; rank: number }>,
): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("save_draft_rankings", {
    p_rankings: rankings,
  } as never);
  if (error) return rpcError(error);
  return {};
}

/**
 * Append a topic to the current draft and redirect to /vote. Used by the
 * topic-detail "Add to my ranking" CTA.
 *
 * TOCTOU note: between the read of the current ballot and the write,
 * another tab could save a different draft. Acceptable for Phase 4 — we
 * dedup the topic locally before sending so the worst case is an
 * idempotent no-op rather than a corrupted ballot.
 */
export async function addToMyRanking(
  topicId: number,
): Promise<{ error?: string }> {
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic." };
  }

  const ballot = await getMyBallot();
  const current = ballot?.rankings ?? [];

  // Already ranked — no-op write, just redirect.
  if (current.some((r) => r.topicId === topicId)) {
    redirect(`/vote?focus=${topicId}`);
  }

  const next = [
    ...current.map((r) => ({ topicId: r.topicId, rank: r.rank })),
    { topicId, rank: current.length + 1 },
  ];

  const result = await saveDraftRankings(next);
  if (result.error) return result;

  redirect(`/vote?focus=${topicId}`);
}
