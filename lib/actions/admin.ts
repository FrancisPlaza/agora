"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
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

// ── assignTopic ──────────────────────────────────────────────────────
// Storage cleanup is the action's job, not the Postgres function's.
// The function clears the row in one transaction; this orchestrates the
// best-effort storage cleanup that runs after. If the storage delete
// fails the row is still in correct state and the orphan files don't
// break anything (next reassignment's list+remove cleans them, and the
// next presenter's upload deletes them via Phase 5's pre-upload sweep).
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

  // Capture prior storage state before the row is cleared.
  const { data: priorTopic } = await supabase
    .from("topics")
    .select("art_image_path, art_uploaded_at")
    .eq("id", topicId)
    .maybeSingle();
  const hadArt = !!priorTopic?.art_uploaded_at;

  const { error } = await supabase.rpc("assign_topic", {
    p_target: targetId,
    p_topic_id: topicId,
  } as never);
  if (error) return rpcError(error);

  // Best-effort storage cleanup (admin role via the service client).
  if (hadArt) {
    const service = createServiceClient();
    const { data: existing } = await service.storage
      .from("presentations")
      .list(`${topicId}/`);
    if (existing && existing.length > 0) {
      const paths = existing.map((o) => `${topicId}/${o.name}`);
      // Intentionally not surfacing a storage-cleanup error to the
      // admin UI — the DB state is correct and orphan files are
      // self-healing on the next presenter upload.
      await service.storage.from("presentations").remove(paths);
    }
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
// `<input type="datetime-local">` returns a naive YYYY-MM-DDTHH:mm
// string with no timezone info. `new Date(value).toISOString()`
// interprets it in the browser's (and here, the server's) local
// timezone — fine for a single-class app where the beadle and voters
// share a timezone.
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
