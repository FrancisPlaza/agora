import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ProfileStatus = Database["public"]["Enums"]["profile_status"];

/**
 * PostgREST returns one-to-one FK embeds as either a single object or
 * (depending on version + the SQL shape) a one-element array. Both shapes
 * occur in practice for `profiles → topics (UNIQUE presenter_voter_id)`
 * and `profiles → ballots (UNIQUE voter_id)`. Type the embed defensively
 * as `T | T[] | null` and unwrap through this helper.
 */
function unwrapEmbed<T>(value: T | T[] | null | undefined): T | null {
  if (value == null) return null;
  return Array.isArray(value) ? (value[0] ?? null) : value;
}

export interface PendingApproval {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  created_at: string;
}

export type BallotStatus = "submitted" | "draft" | "not_started";

export interface VoterRow {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  status: ProfileStatus;
  is_admin: boolean;
  // presented_at flows through so the reassign UI can disable the
  // control when the voter's current topic is locked (post-presentation).
  assigned_topic: {
    id: number;
    philosopher: string;
    theme: string;
    presented_at: string | null;
  } | null;
  ballot_status: BallotStatus;
}

export interface AuditLogEntry {
  id: string;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: Record<string, unknown>;
  actor: { id: string; full_name: string } | null;
}

export interface AdminSummary {
  pending_approvals: number;
  topics_not_presented: number;
  ballots_submitted: number;
  total_voters: number;
  /**
   * Drafts force-locked by `lock_ballots()` that are still unsubmitted.
   * Surfaces the "reopen and unlock drafts" affordance on /admin/voting
   * after a misfired lock.
   */
  force_locked_drafts: number;
}

export interface UnassignedTopic {
  id: number;
  order_num: number;
  philosopher: string;
  theme: string;
}

interface VoterRawRow {
  id: string;
  full_name: string;
  email: string;
  student_id: string;
  status: ProfileStatus;
  is_admin: boolean;
  // PostgREST flips between object and one-element array depending on
  // version + query shape. UNIQUE FKs are conceptually one-to-one in
  // both directions; unwrapEmbed handles either case.
  topics:
    | {
        id: number;
        philosopher: string;
        theme: string;
        presented_at: string | null;
      }
    | Array<{
        id: number;
        philosopher: string;
        theme: string;
        presented_at: string | null;
      }>
    | null;
  ballots:
    | { submitted_at: string | null; locked_at: string | null }
    | Array<{ submitted_at: string | null; locked_at: string | null }>
    | null;
}

interface AuditRawRow {
  id: string;
  created_at: string;
  action: string;
  target_type: string;
  target_id: string | null;
  meta: unknown;
  actor: { id: string; full_name: string } | null;
}

export const getPendingApprovals = cache(
  async (): Promise<PendingApproval[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("profiles")
      .select("id, full_name, email, student_id, created_at")
      .eq("status", "pending_approval")
      .order("created_at", { ascending: false });
    if (error || !data) return [];
    return data;
  },
);

interface VoterFilter {
  statusFilter?: ProfileStatus | "admins";
  search?: string;
}

/**
 * Reads admin's view of every profile. RLS already permits admin reads
 * via `profiles_admin_read_all`. Joins to `topics` (via the FK back-
 * reference on `presenter_voter_id`) for the assigned-topic display, and
 * to `ballots` for the `ballot_status` derivation.
 *
 * Ballot secrecy: this query NEVER reads `rankings`. The ballots select
 * is explicit — only `submitted_at` and `locked_at` are pulled. A grep
 * for `from('rankings')` in this module returns zero by construction.
 */
export const getAllVoters = cache(
  async (filter: VoterFilter = {}): Promise<VoterRow[]> => {
    const supabase = await createClient();
    let q = supabase
      .from("profiles")
      .select(
        `id, full_name, email, student_id, status, is_admin,
         topics:topics!presenter_voter_id (id, philosopher, theme, presented_at),
         ballots:ballots!voter_id (submitted_at, locked_at)`,
      )
      .order("created_at", { ascending: false });

    if (filter.statusFilter && filter.statusFilter !== "admins") {
      q = q.eq("status", filter.statusFilter);
    }

    const { data, error } = await q;
    if (error || !data) return [];

    let rows = (data as unknown as VoterRawRow[]).map<VoterRow>((p) => {
      const ballot = unwrapEmbed(p.ballots);
      const ballot_status: BallotStatus = !ballot
        ? "not_started"
        : ballot.submitted_at || ballot.locked_at
          ? "submitted"
          : "draft";
      return {
        id: p.id,
        full_name: p.full_name,
        email: p.email,
        student_id: p.student_id,
        status: p.status,
        is_admin: p.is_admin,
        assigned_topic: unwrapEmbed(p.topics),
        ballot_status,
      };
    });

    if (filter.statusFilter === "admins") {
      rows = rows.filter((r) => r.is_admin);
    }
    if (filter.search) {
      const s = filter.search.trim().toLowerCase();
      if (s) {
        rows = rows.filter((r) =>
          `${r.full_name} ${r.email} ${r.student_id}`
            .toLowerCase()
            .includes(s),
        );
      }
    }
    return rows;
  },
);

export const getAuditLog = cache(
  async ({ limit = 20 }: { limit?: number } = {}): Promise<AuditLogEntry[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("audit_log")
      .select(
        "id, created_at, action, target_type, target_id, meta, actor:profiles!actor_id (id, full_name)",
      )
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error || !data) return [];
    return (data as unknown as AuditRawRow[]).map((row) => ({
      id: row.id,
      created_at: row.created_at,
      action: row.action,
      target_type: row.target_type,
      target_id: row.target_id,
      meta: (row.meta as Record<string, unknown>) ?? {},
      actor: row.actor,
    }));
  },
);

export const getAdminSummary = cache(async (): Promise<AdminSummary> => {
  const supabase = await createClient();
  const [pending, topicsResult, ballotsResult, votersResult, forceLockedResult] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending_approval"),
      supabase
        .from("topics")
        .select("id", { count: "exact", head: true })
        .is("presented_at", null),
      supabase
        .from("ballots")
        .select("id", { count: "exact", head: true })
        .not("submitted_at", "is", null),
      // Total voters = approved profiles with an assigned topic.
      supabase
        .from("topics")
        .select("id", { count: "exact", head: true })
        .not("presenter_voter_id", "is", null),
      // Force-locked drafts = unsubmitted ballots with locked_at set.
      supabase
        .from("ballots")
        .select("id", { count: "exact", head: true })
        .is("submitted_at", null)
        .not("locked_at", "is", null),
    ]);

  return {
    pending_approvals: pending.count ?? 0,
    topics_not_presented: topicsResult.count ?? 0,
    ballots_submitted: ballotsResult.count ?? 0,
    total_voters: votersResult.count ?? 0,
    force_locked_drafts: forceLockedResult.count ?? 0,
  };
});

export const getUnassignedTopics = cache(
  async (): Promise<UnassignedTopic[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("topics")
      .select("id, order_num, philosopher, theme")
      .is("presenter_voter_id", null)
      .order("order_num");
    if (error || !data) return [];
    return data;
  },
);

/**
 * Topics eligible as a reassignment destination: any topic that hasn't
 * been presented yet, regardless of whether it currently has a presenter.
 * The new assign_topic function (migration 0020) clears the source row
 * atomically, so a topic currently assigned to someone else but not yet
 * presented is a valid swap target.
 *
 * The strict `getUnassignedTopics` stays — first-time approval (in the
 * approvals queue) shouldn't yank a topic from its existing presenter
 * by accident.
 */
export const getReassignableTopics = cache(
  async (): Promise<UnassignedTopic[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("topics")
      .select("id, order_num, philosopher, theme")
      .is("presented_at", null)
      .order("order_num");
    if (error || !data) return [];
    return data;
  },
);
