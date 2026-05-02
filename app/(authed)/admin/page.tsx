import type { Metadata } from "next";
import Link from "next/link";
import { Avatar } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import {
  getAdminSummary,
  getAuditLog,
  type AuditLogEntry,
} from "@/lib/data/admin";
import { formatRelative } from "@/lib/relative-time";

// `absolute` bypasses both the admin layout's "%s | Admin | Agora"
// template and the root layout's "%s | Agora" template — without it,
// the layout's default would be wrapped to "Admin | Agora | Agora".
export const metadata: Metadata = { title: { absolute: "Admin | Agora" } };

const ACTION_VERBS: Record<string, string> = {
  approve_voter: "approved",
  approve_non_voter: "approved as non-voting admin",
  reject_voter: "rejected",
  assign_topic: "assigned",
  reassign_topic: "reassigned",
  mark_presented: "marked presented",
  lock_ballots: "locked all ballots",
  unlock_ballot: "unlocked ballot for",
  set_deadline: "set the deadline",
  open_polls: "opened polls",
  run_tally: "ran the tally",
  submit_ballot: "submitted ballot",
};

function describeAuditTarget(entry: AuditLogEntry): string {
  if (entry.target_type === "system") return "";
  if (entry.target_type === "topic" && entry.target_id) {
    return `topic ${String(entry.target_id).padStart(2, "0")}`;
  }
  if (entry.target_type === "voter") {
    // We don't have the target's display name here without an extra
    // join — Phase 6 keeps this lean. Show the truncated id; the meta
    // payload often carries enough context (topic_id, reason).
    return entry.target_id ? entry.target_id.slice(0, 8) : "";
  }
  return entry.target_id ?? "";
}

export default async function AdminHome() {
  const [summary, audit] = await Promise.all([
    getAdminSummary(),
    getAuditLog({ limit: 20 }),
  ]);

  const cards = [
    {
      id: "approvals" as const,
      title: "Pending approvals",
      value: summary.pending_approvals,
      foot: "Awaiting beadle review",
      href: "/admin/approvals",
    },
    {
      id: "topics" as const,
      title: "Topics not yet presented",
      value: summary.topics_not_presented,
      foot: "Out of 32 topics",
      href: "/admin/topics",
    },
    {
      id: "ballots" as const,
      title: "Ballots submitted",
      value: `${summary.ballots_submitted} of ${summary.total_voters}`,
      foot: "Of currently-assigned voters",
      href: "/admin/voting",
    },
  ];

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Admin overview
      </h1>
      <p className="text-text-2 mb-6">
        Approvals, presentations, ballots — all in one place.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        {cards.map((c) => (
          <Link key={c.id} href={c.href}>
            <Card pad className="cursor-pointer transition-shadow duration-100 hover:shadow-[0_4px_14px_rgba(10,37,64,0.08),0_1px_3px_rgba(10,37,64,0.05)]">
              <div className="flex items-center justify-between">
                <div className="text-text-2 text-xs font-medium uppercase tracking-[0.04em]">
                  {c.title}
                </div>
                <Icon name="arrow-r" size={14} />
              </div>
              <div className="font-serif text-4xl font-semibold leading-tight tracking-tight my-2">
                {c.value}
              </div>
              <div className="text-text-2 text-[13px]">{c.foot}</div>
            </Card>
          </Link>
        ))}
      </div>

      <Card>
        <div className="px-5 py-4 border-b border-line-2">
          <div className="font-semibold">Audit log</div>
          <div className="text-text-2 text-[13px]">
            Recent admin actions across the class.
          </div>
        </div>
        <div>
          {audit.length === 0 ? (
            <div className="px-5 py-8 text-center text-text-2 text-[13px]">
              No admin actions yet.
            </div>
          ) : (
            audit.map((a, i) => (
              <div
                key={a.id}
                className={[
                  "flex gap-3.5 px-5 py-3.5 items-center",
                  i < audit.length - 1 ? "border-b border-line-2" : "",
                ].join(" ")}
              >
                <Avatar name={a.actor?.full_name ?? "?"} size={28} />
                <div className="flex-1 min-w-0">
                  <div className="text-sm">
                    <b>{a.actor?.full_name ?? "Unknown"}</b>{" "}
                    <span className="text-text-2">
                      {ACTION_VERBS[a.action] ?? a.action}
                    </span>{" "}
                    <b>{describeAuditTarget(a)}</b>
                  </div>
                  <div className="text-text-2 text-xs">
                    {formatRelative(a.created_at)}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>
    </div>
  );
}
