"use server";

import { createClient } from "@/lib/supabase/server";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Not authenticated",
  NOT_ELIGIBLE: "You are not eligible to vote — no assigned topic",
  INVALID_RANKINGS: "Invalid rankings format",
  EMPTY_BALLOT: "Ballot must have at least one ranking",
  DUPLICATE_RANK: "Duplicate ranks not allowed",
  DUPLICATE_TOPIC: "Duplicate topics not allowed",
  INVALID_TOPIC: "One or more topic IDs are invalid",
  BALLOT_LOCKED: "Ballot is already locked — contact a beadle to unlock",
};

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

  if (error) {
    const code = error.message.trim();
    return {
      error: ERROR_MESSAGES[code] ?? `Failed to submit ballot: ${error.message}`,
    };
  }

  return {};
}
