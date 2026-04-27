import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";

type ProfileStatus = Database["public"]["Enums"]["profile_status"];

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
  assigned_topic: {
    id: number;
    philosopher: string;
    theme: string;
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
  topics: Array<{
    id: number;
    philosopher: string;
    theme: string;
  }>;
  ballots: Array<{
    submitted_at: string | null;
    locked_at: string | null;
  }>;
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
         topics:topics!presenter_voter_id (id, philosopher, theme),
         ballots:ballots!voter_id (submitted_at, locked_at)`,
      )
      .order("created_at", { ascending: false });

    if (filter.statusFilter && filter.statusFilter !== "admins") {
      q = q.eq("status", filter.statusFilter);
    }

    const { data, error } = await q;
    if (error || !data) return [];

    let rows = (data as unknown as VoterRawRow[]).map<VoterRow>((p) => {
      const ballot = p.ballots[0];
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
        assigned_topic: p.topics[0] ?? null,
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
  const [pending, topicsResult, ballotsResult, votersResult] = await Promise.all([
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
  ]);

  return {
    pending_approvals: pending.count ?? 0,
    topics_not_presented: topicsResult.count ?? 0,
    ballots_submitted: ballotsResult.count ?? 0,
    total_voters: votersResult.count ?? 0,
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
