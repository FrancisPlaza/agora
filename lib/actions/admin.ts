"use server";

/**
 * Admin server actions. Most are stubs for Phase 1 — fully implemented
 * in Phase 6 when admin views are built.
 */

// TODO Phase 6: approve_voter — sets profiles.status = 'approved', assigns topic, audit logs
export async function approveVoter(
  _targetId: string,
  _topicId: number,
  _isAdmin = false,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: approve_non_voter — approve without topic (for professor)
export async function approveNonVoter(
  _targetId: string,
  _isAdmin = true,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: reject_voter — sets profiles.status = 'rejected', audit logs
export async function rejectVoter(
  _targetId: string,
  _reason: string,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: assign_topic — sets topics.presenter_voter_id, audit logs
export async function assignTopic(
  _targetId: string,
  _topicId: number,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: mark_topic_presented — sets topics.presented_at, audit logs
export async function markTopicPresented(
  _topicId: number,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: unlock_ballot — clears submitted_at and locked_at, audit logs
export async function unlockBallot(
  _targetVoterId: string,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: lock_ballots — sets voting_state.polls_locked, locks all unsubmitted, audit logs
export async function lockBallots(): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}

// TODO Phase 6: set_deadline — updates voting_state.deadline_at, audit logs
export async function setDeadline(
  _deadline: string,
): Promise<{ error: string }> {
  return { error: "Not implemented — Phase 6" };
}
