import type { Metadata } from "next";
import { Badge, type BadgeTone } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Chips } from "@/components/ui/chips";
import { getAllVoters } from "@/lib/data/admin";
import { getAllTopics, type TopicState } from "@/lib/data/topics";
import { derivePollsState, getVotingState } from "@/lib/data/voting";
import { TopicRowActions } from "./topic-row-actions";

export const metadata: Metadata = { title: "Topics" };

const STATE_TONE: Record<TopicState, BadgeTone> = {
  unassigned: "neutral",
  assigned: "violet",
  presented: "amber",
  published: "success",
};

const STATE_LABEL: Record<TopicState, string> = {
  unassigned: "Unassigned",
  assigned: "Assigned",
  presented: "Presented",
  published: "Published",
};

type Filter = "all" | TopicState;
const FILTERS: Array<{ id: Filter; label: string }> = [
  { id: "all", label: "All" },
  { id: "unassigned", label: "Unassigned" },
  { id: "assigned", label: "Assigned" },
  { id: "presented", label: "Presented" },
  { id: "published", label: "Published" },
];

const EMPTY_STATE: Record<Filter, { headline: string; sub: string | null }> = {
  all: { headline: "Nothing matches this filter", sub: null },
  unassigned: { headline: "Nothing matches this filter", sub: null },
  assigned: { headline: "Nothing matches this filter", sub: null },
  presented: {
    headline: "Nothing presented yet",
    sub: "Topics will land here as they’re marked presented.",
  },
  published: {
    headline: "Nothing published yet",
    sub: "Topics will land here once presenters upload their artwork.",
  },
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

function fmtDate(input: string | null): string {
  if (!input) return "—";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
  });
}

export default async function AdminTopics({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterParam = (params.filter ?? "all") as Filter;
  const filter: Filter = FILTERS.some((f) => f.id === filterParam)
    ? filterParam
    : "all";

  const [topics, voters, voting] = await Promise.all([
    getAllTopics(),
    getAllVoters({ statusFilter: "approved" }),
    getVotingState(),
  ]);

  // pollsLocked captures the union: manual lock OR deadline passed OR
  // tally cached. Mirrors the function-level POLLS_LOCKED gate
  // (migrations 0021 + 0022). Reopening polls clears all three flags
  // via 0019, so this un-blocks itself automatically.
  const polls = derivePollsState(
    {
      polls_locked: voting?.polls_locked ?? false,
      polls_open_at: voting?.polls_open_at ?? null,
      deadline_at: voting?.deadline_at ?? null,
    },
    new Date(),
  );
  const pollsLocked = polls === "closed" || !!voting?.tally_run_at;

  // For reassignment, valid targets are approved voters who EITHER have
  // no current topic OR have a current topic that hasn't been presented
  // yet. Migration 0020's assign_topic clears the source row atomically,
  // so swapping a voter from one unpresented topic to another is a
  // legitimate flow. Voters whose current topic is already presented are
  // locked.
  //
  // Only NON-voting admins are excluded — they're not presenters.
  // Beadles (is_admin=true AND have a topic) are voters too and should
  // appear as valid targets.
  const reassignableVoters = voters
    .filter((v) => {
      const isNonVotingAdmin = v.is_admin && !v.assigned_topic;
      if (isNonVotingAdmin) return false;
      return !v.assigned_topic || v.assigned_topic.presented_at === null;
    })
    .map((v) => ({
      id: v.id,
      full_name: v.full_name,
      current_topic: v.assigned_topic
        ? { philosopher: v.assigned_topic.philosopher }
        : null,
    }));

  const visible = filter === "all" ? topics : topics.filter((t) => t.state === filter);

  return (
    <div>
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0 mb-1">
        Topics
      </h1>
      <p className="text-text-2 mb-4">
        Mark topics as presented as they happen. Reassign if a presenter swaps.
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
                  Nº
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Topic
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  State
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Presenter
                </th>
                <th className="text-left text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Date
                </th>
                <th className="text-right text-text-2 text-xs uppercase tracking-[0.04em] font-medium px-3 py-2.5 border-b border-line">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {visible.length === 0 ? (
                <tr>
                  <td
                    colSpan={6}
                    className="text-center px-3 py-12 text-text-2"
                  >
                    <div className="font-serif text-lg mb-1">
                      {EMPTY_STATE[filter].headline}
                    </div>
                    {EMPTY_STATE[filter].sub ? (
                      <div className="text-[13px]">
                        {EMPTY_STATE[filter].sub}
                      </div>
                    ) : null}
                  </td>
                </tr>
              ) : (
                visible.map((t) => (
                  <tr key={t.id} className="border-b border-line-2 last:border-0">
                  <td className="px-3 py-3 font-mono tabular-nums text-[13px] text-text-2">
                    {String(t.order_num).padStart(2, "0")}
                  </td>
                  <td className="px-3 py-3">
                    <div className="font-medium text-sm">{t.philosopher}</div>
                    <div className="text-text-2 text-xs italic">{t.theme}</div>
                  </td>
                  <td className="px-3 py-3">
                    <Badge tone={STATE_TONE[t.state]}>{STATE_LABEL[t.state]}</Badge>
                  </td>
                  <td className="px-3 py-3 text-[13px]">
                    {t.presenter?.full_name ?? (
                      <span className="text-text-2 italic">none</span>
                    )}
                  </td>
                  <td className="px-3 py-3 text-text-2 text-[13px]">
                    {t.state === "presented" || t.state === "published"
                      ? fmtDate(t.presented_at)
                      : t.state === "assigned"
                        ? fmtDate(t.scheduled_for)
                        : "—"}
                  </td>
                  <td className="px-3 py-3 align-middle">
                    <TopicRowActions
                      topicId={t.id}
                      topicLabel={`Nº ${String(t.order_num).padStart(2, "0")} · ${t.philosopher}`}
                      state={t.state}
                      hadArt={!!t.art_uploaded_at}
                      currentPresenterId={t.presenter_voter_id ?? null}
                      pollsLocked={pollsLocked}
                      reassignableVoters={reassignableVoters}
                    />
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
