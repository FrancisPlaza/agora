"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { dispatchApprovalEmail } from "@/lib/email/approval";
import { createClient, createServiceClient } from "@/lib/supabase/server";
import { runTally } from "@/lib/actions/tally";

const ERROR_MESSAGES: Record<string, string> = {
  NOT_AUTHENTICATED: "Not authenticated",
  ADMIN_REQUIRED: "Admin access required",
  TARGET_NOT_FOUND: "That voter no longer exists",
  TOPIC_NOT_FOUND: "That topic doesn't exist",
  TOPIC_TAKEN: "Another voter is already assigned to that topic",
  INVALID_STATE: "That topic isn't in the right state for this action",
  NO_BALLOT: "That voter hasn't started a ballot yet",
  STUDENT_ALREADY_PRESENTED:
    "This student has already presented and can't be reassigned. Their topic is locked.",
  TOPIC_ALREADY_PRESENTED:
    "This topic has already been presented and can't be reassigned to a new presenter.",
  POLLS_LOCKED:
    "Polls are locked. Reopen polls to continue.",
};

function rpcError(error: { message: string }): { error: string } {
  const code = error.message.trim();
  return {
    error: ERROR_MESSAGES[code] ?? `Action failed: ${error.message}`,
  };
}

function revalidateAdmin() {
  revalidatePath("/admin");
  revalidatePath("/admin/approvals");
  revalidatePath("/admin/voters");
  revalidatePath("/admin/topics");
  revalidatePath("/admin/voting");
  // Voter-facing pages whose state derives from these admin actions:
  revalidatePath("/dashboard");
  revalidatePath("/vote");
}

// ── approveVoter ─────────────────────────────────────────────────────
export async function approveVoter(
  formData: FormData,
): Promise<{ error?: string }> {
  const targetId = String(formData.get("targetId") ?? "");
  const topicIdRaw = String(formData.get("topicId") ?? "");
  const topicId = topicIdRaw ? Number(topicIdRaw) : null;
  const isAdmin = formData.get("isAdmin") === "on";

  if (!targetId) return { error: "Missing voter id." };
  if (topicId !== null && (!Number.isFinite(topicId) || topicId < 1)) {
    return { error: "Invalid topic id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("approve_voter", {
    p_target: targetId,
    p_topic_id: topicId,
    p_is_admin: isAdmin,
  } as never);

  if (error) return rpcError(error);

  // Best-effort approval email. Generates a magic link, looks up topic
  // info, sends via Resend. Failures are non-blocking — they log to
  // console.error and write an audit_log row but never roll back the
  // approval that just succeeded.
  const { data: { user } } = await supabase.auth.getUser();
  if (user) {
    const supabaseAdmin = createServiceClient();
    const siteUrl =
      process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ??
      "http://localhost:3000";
    await dispatchApprovalEmail({
      supabase,
      supabaseAdmin,
      targetId,
      topicId,
      actorId: user.id,
      siteUrl,
    });
  }

  revalidateAdmin();
  return {};
}

// ── rejectVoter ──────────────────────────────────────────────────────
export async function rejectVoter(
  formData: FormData,
): Promise<{ error?: string }> {
  const targetId = String(formData.get("targetId") ?? "");
  const reason = String(formData.get("reason") ?? "").trim();
  if (!targetId) return { error: "Missing voter id." };
  if (!reason) return { error: "A rejection reason is required." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("reject_voter", {
    p_target: targetId,
    p_reason: reason,
  } as never);

  if (error) return rpcError(error);
  revalidateAdmin();
  return {};
}

// ── deleteVoter ──────────────────────────────────────────────────────
// Pragmatic implementation — no SQL function, no row locks. The race
// window between validation and deletion is microseconds and the
// consequence (a concurrent ballot submission cascaded with the user)
// is recoverable via re-registration.
//
// Cascade chain on auth.admin.deleteUser:
//   auth.users → profiles (cascade)
//   profiles   → ballots, notes (cascade)
//   ballots    → rankings (cascade)
//   profiles   → topics.presenter_voter_id (set null per 0001)
//
// FKs that previously blocked profile deletion (audit_log.actor_id,
// profiles.approved_by/rejected_by, voting_state.polls_locked_by)
// were relaxed to ON DELETE SET NULL in migration 0026.

export type DeleteVoterError =
  | "NOT_AUTHORISED"
  | "SELF_DELETE_FORBIDDEN"
  | "NOT_FOUND"
  | "ALREADY_PRESENTED"
  | "BALLOT_SUBMITTED"
  | "DELETE_FAILED";

export type DeleteVoterResult =
  | { ok: true }
  | { ok: false; error: DeleteVoterError };

interface VoterRow {
  id: string;
  email: string;
  full_name: string;
  student_id: string;
  is_admin: boolean;
}

interface AssignedTopicRow {
  id: number;
  presented_at: string | null;
  art_image_path: string | null;
}

interface BallotRow {
  submitted_at: string | null;
}

export async function deleteVoter(
  targetProfileId: string,
): Promise<DeleteVoterResult> {
  if (!targetProfileId) return { ok: false, error: "NOT_FOUND" };

  // 1. Auth check — caller must be an approved admin.
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "NOT_AUTHORISED" };

  const { data: caller } = await supabase
    .from("profiles")
    .select("id, is_admin, status")
    .eq("id", user.id)
    .maybeSingle();

  if (!caller || caller.status !== "approved" || !caller.is_admin) {
    return { ok: false, error: "NOT_AUTHORISED" };
  }

  // Self-delete guard. Even an admin shouldn't be able to remove their
  // own profile through the voters list — would lock them out and
  // strand any in-flight admin action mid-flight. The UI also disables
  // the button on the caller's own row; this is the backstop.
  if (caller.id === targetProfileId) {
    return { ok: false, error: "SELF_DELETE_FORBIDDEN" };
  }

  // 2. Load target + assigned topic + ballot in one shot. Embedded
  //    selects produce arrays in @supabase/ssr; unwrap to the single
  //    row each FK actually permits.
  const { data: targetRaw } = await supabase
    .from("profiles")
    .select(
      `id, email, full_name, student_id, is_admin,
       topics:topics!presenter_voter_id (id, presented_at, art_image_path),
       ballots:ballots!voter_id (submitted_at)`,
    )
    .eq("id", targetProfileId)
    .maybeSingle();

  if (!targetRaw) return { ok: false, error: "NOT_FOUND" };

  const target: VoterRow = {
    id: targetRaw.id,
    email: targetRaw.email,
    full_name: targetRaw.full_name,
    student_id: targetRaw.student_id,
    is_admin: targetRaw.is_admin,
  };
  const targetTopic: AssignedTopicRow | null = unwrapEmbed(targetRaw.topics);
  const targetBallot: BallotRow | null = unwrapEmbed(targetRaw.ballots);

  // 3. Validate. Disabled-button gate prevents these in normal flow;
  //    the action is the backstop for race conditions.
  if (targetTopic?.presented_at) {
    return { ok: false, error: "ALREADY_PRESENTED" };
  }
  if (targetBallot?.submitted_at) {
    return { ok: false, error: "BALLOT_SUBMITTED" };
  }

  const supabaseAdmin = createServiceClient();

  // 4. Storage cleanup. List + remove every object under the topic's
  //    prefix. Tolerant of an empty bucket prefix (no-op).
  if (targetTopic) {
    const prefix = `${targetTopic.id}/`;
    const { data: existing } = await supabaseAdmin.storage
      .from("presentations")
      .list(prefix);
    if (existing && existing.length > 0) {
      const paths = existing.map((o) => `${prefix}${o.name}`);
      // Best-effort: storage failure is logged but doesn't block the
      // delete. The orphaned objects are recoverable manually if it
      // ever matters for a class tool of 32 students.
      const { error: removeError } = await supabaseAdmin.storage
        .from("presentations")
        .remove(paths);
      if (removeError) {
        console.error(
          `[deleteVoter] storage cleanup failed for ${prefix}: ${removeError.message}`,
        );
      }
    }
  }

  // 5. Audit log insert BEFORE the auth.admin.deleteUser call. Captures
  //    the deleted user's identity so the row is meaningful even after
  //    the profile is gone. actor_id remains valid (the caller isn't
  //    being deleted); the FK's new ON DELETE SET NULL only matters if
  //    the caller is later deleted themselves.
  await supabaseAdmin.from("audit_log").insert({
    actor_id: caller.id,
    action: "voter_deleted",
    target_type: "voter",
    target_id: target.id,
    meta: {
      email: target.email,
      full_name: target.full_name,
      student_id: target.student_id,
      was_admin: target.is_admin,
      was_assigned_topic_id: targetTopic?.id ?? null,
    },
  });

  // 6. Delete the auth user. Cascade handles profiles → ballots →
  //    rankings → notes. topics.presenter_voter_id sets null.
  const { error: deleteError } =
    await supabaseAdmin.auth.admin.deleteUser(target.id);
  if (deleteError) {
    console.error(
      `[deleteVoter] auth.admin.deleteUser failed for ${target.id}: ${deleteError.message}`,
    );
    return { ok: false, error: "DELETE_FAILED" };
  }

  // 7. Revalidate.
  revalidateAdmin();
  return { ok: true };
}

/**
 * Supabase's @supabase/ssr returns embedded relations as arrays even
 * for one-to-one FKs. Unwrap to the single row (or null).
 */
function unwrapEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

// ── assignTopic ──────────────────────────────────────────────────────
// Storage cleanup is the action's job, not the Postgres function's.
// The function clears row state in one transaction; this orchestrates
// the best-effort storage cleanup for both prefixes that may have art:
//
//   • Destination — the topic the student is being assigned TO. Cleaned
//     since 0014 / Phase 6.
//   • Source — the student's previously-assigned topic, if any. Added
//     in 0020 / this fix; the new function clears the row's art fields
//     atomically, but storage objects need their own sweep.
//
// Both sweeps are best-effort. If either fails the DB state is still
// correct; orphans self-heal on the next reassignment's pre-write
// list+remove or the next presenter's pre-upload list+remove (Phase 5).
export async function assignTopic(
  formData: FormData,
): Promise<{ error?: string }> {
  const targetId = String(formData.get("targetId") ?? "");
  const topicId = Number(formData.get("topicId") ?? "");
  if (!targetId) return { error: "Missing voter id." };
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic id." };
  }

  const supabase = await createClient();

  // Capture prior storage state for BOTH prefixes before the row is
  // cleared. Run in parallel — both are single-row reads scoped to
  // small primary-key indexes.
  const [{ data: destPrior }, { data: srcPrior }] = await Promise.all([
    supabase
      .from("topics")
      .select("art_uploaded_at")
      .eq("id", topicId)
      .maybeSingle(),
    supabase
      .from("topics")
      .select("id, art_uploaded_at")
      .eq("presenter_voter_id", targetId)
      .neq("id", topicId)
      .maybeSingle(),
  ]);
  const destHadArt = !!destPrior?.art_uploaded_at;
  const srcHadArt = !!srcPrior?.art_uploaded_at;
  const srcTopicId = srcPrior?.id ?? null;

  const { error } = await supabase.rpc("assign_topic", {
    p_target: targetId,
    p_topic_id: topicId,
  } as never);
  if (error) return rpcError(error);

  // Best-effort storage cleanup against both prefixes that had art.
  // Intentionally not surfacing storage errors — the DB state is
  // correct and orphan files are self-healing.
  if (destHadArt || (srcHadArt && srcTopicId != null)) {
    const service = createServiceClient();
    async function clearPrefix(id: number) {
      const { data: existing } = await service.storage
        .from("presentations")
        .list(`${id}/`);
      if (existing && existing.length > 0) {
        await service.storage
          .from("presentations")
          .remove(existing.map((o) => `${id}/${o.name}`));
      }
    }
    if (destHadArt) await clearPrefix(topicId);
    if (srcHadArt && srcTopicId != null) await clearPrefix(srcTopicId);
  }

  revalidateAdmin();
  return {};
}

// ── markTopicPresented ───────────────────────────────────────────────
export async function markTopicPresented(
  formData: FormData,
): Promise<{ error?: string }> {
  const topicId = Number(formData.get("topicId") ?? "");
  if (!Number.isFinite(topicId) || topicId < 1) {
    return { error: "Invalid topic id." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("mark_topic_presented", {
    p_topic_id: topicId,
  } as never);

  if (error) return rpcError(error);
  revalidateAdmin();
  revalidatePath(`/topic/${topicId}`);
  revalidatePath(`/topic/${topicId}/upload`);
  return {};
}

// ── lockBallots ──────────────────────────────────────────────────────
export async function lockBallots(): Promise<{ error?: string }> {
  const supabase = await createClient();
  const { error } = await supabase.rpc("lock_ballots", {} as never);
  if (error) return rpcError(error);
  revalidateAdmin();
  return {};
}

// ── unlockBallot ─────────────────────────────────────────────────────
export async function unlockBallot(
  formData: FormData,
): Promise<{ error?: string }> {
  const targetId = String(formData.get("targetVoterId") ?? "");
  if (!targetId) return { error: "Missing voter id." };

  const supabase = await createClient();
  const { error } = await supabase.rpc("unlock_ballot", {
    p_target: targetId,
  } as never);
  if (error) return rpcError(error);
  revalidateAdmin();
  return {};
}

// ── setDeadline ──────────────────────────────────────────────────────
// Contract: `deadlineIso` is already a fully-qualified UTC ISO string
// (e.g. "2026-05-31T15:59:00.000Z"). The DeadlineForm client converts
// the naive datetime-local input to ISO in the browser's timezone
// before sending so the server doesn't re-interpret it. We don't
// rely on the server's TZ matching the user's — Vercel runs in UTC,
// users live in Manila.
export async function setDeadline(
  formData: FormData,
): Promise<{ error?: string }> {
  const raw = String(formData.get("deadlineIso") ?? "").trim();
  if (!raw) return { error: "Pick a deadline first." };
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) {
    return { error: "Invalid deadline." };
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("set_deadline", {
    p_at: parsed.toISOString(),
  } as never);
  if (error) return rpcError(error);
  revalidateAdmin();
  return {};
}

// ── openPolls ────────────────────────────────────────────────────────
export async function openPolls(
  formData: FormData,
): Promise<{ error?: string }> {
  const raw = String(formData.get("openAtIso") ?? "").trim();
  let parsedIso: string | null = null;
  if (raw) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { error: "Invalid open time." };
    parsedIso = parsed.toISOString();
  }

  const supabase = await createClient();
  const { error } = await supabase.rpc("open_polls", {
    p_at: parsedIso,
  } as never);
  if (error) return rpcError(error);
  revalidateAdmin();
  return {};
}

// ── reopenPollsAndUnlockDrafts ───────────────────────────────────────
// Wraps the common "I locked ballots by mistake" recovery path:
// open_polls() to clear the polls-locked flag, then unlock_ballot() per
// force-locked draft so voters can resume editing. Uses the user-scoped
// client (admin's session) so each unlock_ballot RPC runs with
// auth.uid() = admin_id and audit-logs correctly. Service-role would
// bypass the audit identity.
export async function reopenPollsAndUnlockDrafts(
  formData: FormData,
): Promise<{ error?: string; unlocked?: number }> {
  const raw = String(formData.get("openAtIso") ?? "").trim();
  let parsedIso: string | null = null;
  if (raw) {
    const parsed = new Date(raw);
    if (Number.isNaN(parsed.getTime())) return { error: "Invalid open time." };
    parsedIso = parsed.toISOString();
  }

  const supabase = await createClient();

  const { error: openErr } = await supabase.rpc("open_polls", {
    p_at: parsedIso,
  } as never);
  if (openErr) return rpcError(openErr);

  const { data: ballots, error: listErr } = await supabase
    .from("ballots")
    .select("voter_id")
    .is("submitted_at", null)
    .not("locked_at", "is", null);
  if (listErr) {
    return { error: `Failed to list locked drafts: ${listErr.message}` };
  }

  let failures = 0;
  for (const b of ballots ?? []) {
    const { error: unlockErr } = await supabase.rpc("unlock_ballot", {
      p_target: b.voter_id,
    } as never);
    if (unlockErr) failures++;
  }

  revalidatePath("/admin/voting");
  revalidatePath("/admin");
  revalidatePath("/dashboard");
  revalidatePath("/vote");

  if (failures > 0) {
    return {
      error: `Polls reopened, but ${failures} ballot${failures === 1 ? "" : "s"} failed to unlock. Try unlocking from /admin/voters individually.`,
    };
  }
  return { unlocked: ballots?.length ?? 0 };
}

// ── runTallyFromAdmin ────────────────────────────────────────────────
// Wraps lib/actions/tally.ts#runTally so the admin button can redirect
// to /results on success. tally.ts stays untouched.
//
// Phase 7 moved the results page out of /admin/ since voters can read
// it too (RLS already permits via tally_results_approved_read). The
// dashboard banner CTA + this redirect both point at /results now.
export async function runTallyFromAdmin(): Promise<{ error?: string }> {
  const result = await runTally();
  if (result.error) return result;
  revalidateAdmin();
  revalidatePath("/results");
  redirect("/results");
}
