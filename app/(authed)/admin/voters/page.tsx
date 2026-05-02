import type { Metadata } from "next";
import { Avatar } from "@/components/ui/avatar";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Chips } from "@/components/ui/chips";
import { requireAdmin } from "@/lib/auth";
import {
  getAllVoters,
  getReassignableTopics,
  type BallotStatus,
} from "@/lib/data/admin";
import { derivePollsState, getVotingState } from "@/lib/data/voting";
import type { Database } from "@/lib/supabase/database.types";
import { VoterRowActions } from "./voter-row-actions";

export const metadata: Metadata = { title: "Voters" };

type ProfileStatus = Database["public"]["Enums"]["profile_status"];
type Filter = "all" | ProfileStatus | "admins";

const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "approved", label: "Approved" },
  { id: "pending_approval", label: "Pending" },
  { id: "rejected", label: "Rejected" },
  { id: "admins", label: "Admins" },
];

const STATUS_TONE: Record<ProfileStatus, BadgeTone> = {
  approved: "success",
  pending_email: "neutral",
  pending_approval: "violet",
  rejected: "danger",
};

const STATUS_LABEL: Record<ProfileStatus, string> = {
  approved: "Approved",
  pending_email: "Pending email",
  pending_approval: "Pending approval",
  rejected: "Rejected",
};

const BALLOT_TONE: Record<BallotStatus, BadgeTone> = {
  submitted: "success",
  draft: "violet",
  not_started: "neutral",
};

const BALLOT_LABEL: Record<BallotStatus, string> = {
  submitted: "Submitted",
  draft: "Draft",
  not_started: "Not started",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function AdminVoters({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterParam = (params.filter ?? "all") as Filter;
  const filter: Filter = FILTERS.some((f) => f.id === filterParam)
    ? filterParam
    : "all";

  const statusFilter: ProfileStatus | "admins" | undefined =
    filter === "all"
      ? undefined
      : (filter as ProfileStatus | "admins");

  const [me, voters, reassignableTopics, voting] = await Promise.all([
    requireAdmin(),
    getAllVoters({ statusFilter }),
    getReassignableTopics(),
    getVotingState(),
  ]);

  // pollsLocked captures the union: manual lock OR deadline passed OR
  // tally cached. Gates per-voter writes (reassign + unlock_ballot)
  // because each would create voter-intent or tally-consistency
  // problems once ballots are committed. Reopening polls clears all
  // three flags via 0019, so this un-blocks itself. Mirrors the
  // function-level POLLS_LOCKED gate (migrations 0021 + 0022).
  const polls = derivePollsState(
    {
      polls_locked: voting?.polls_locked ?? false,
      polls_open_at: voting?.polls_open_at ?? null,
      deadline_at: voting?.deadline_at ?? null,
    },
    new Date(),
  );
  const pollsLocked = polls === "closed" || !!voting?.tally_run_at;

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Voters
      </h1>
      <p className="text-text-2 mb-4">
        Every registered profile, with their assigned topic and ballot status.
      </p>

      <div className="mb-4">
        <Chips paramKey="filter" defaultId="all" items={FILTERS} />
      </div>

      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-surface-alt">
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Voter
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Status
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Topic
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Ballot
                </th>
                <th className="text-right text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {voters.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="text-center px-3 py-10 text-text-2 text-[13px]"
                  >
                    No voters match this filter.
                  </td>
                </tr>
              ) : (
                voters.map((v) => (
                  <tr key={v.id} className="border-b border-line-2 last:border-0">
                    <td className="px-3 py-3 align-middle">
                      <div className="flex items-center gap-2.5">
                        <Avatar name={v.full_name} size={28} />
                        <div className="min-w-0">
                          <div className="font-medium text-sm truncate">
                            {v.full_name}
                            {v.is_admin ? (
                              <span className="ml-1.5 align-middle">
                                <Badge tone="navy" icon="shield">
                                  Beadle
                                </Badge>
                              </span>
                            ) : null}
                          </div>
                          <div className="text-text-2 text-xs truncate">
                            {v.email}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3 align-middle">
                      <Badge tone={STATUS_TONE[v.status]}>
                        {STATUS_LABEL[v.status]}
                      </Badge>
                    </td>
                    <td className="px-3 py-3 align-middle text-[13px]">
                      {v.assigned_topic ? (
                        <>
                          <div className="font-medium">
                            {v.assigned_topic.philosopher}
                          </div>
                          <div className="text-text-2 text-xs italic">
                            {v.assigned_topic.theme}
                          </div>
                        </>
                      ) : (
                        <span className="text-text-2 italic">none</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {v.assigned_topic ? (
                        <Badge tone={BALLOT_TONE[v.ballot_status]}>
                          {BALLOT_LABEL[v.ballot_status]}
                        </Badge>
                      ) : (
                        <span className="text-text-2 text-xs">—</span>
                      )}
                    </td>
                    <td className="px-3 py-3 align-middle">
                      {v.status === "approved" ? (
                        <VoterRowActions
                          voterId={v.id}
                          voterName={v.full_name}
                          currentUserId={me.id}
                          ballot_status={v.ballot_status}
                          hasArt={false /* admin voter list doesn't carry art state — handled in /admin/topics */}
                          isNonVotingAdmin={v.is_admin && !v.assigned_topic}
                          currentTopicId={v.assigned_topic?.id ?? null}
                          currentTopicPresented={!!v.assigned_topic?.presented_at}
                          currentTopicPhilosopher={v.assigned_topic?.philosopher ?? null}
                          currentTopicTheme={v.assigned_topic?.theme ?? null}
                          pollsLocked={pollsLocked}
                          reassignableTopics={reassignableTopics}
                        />
                      ) : null}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
