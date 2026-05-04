import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RankingEditor } from "@/components/ranking-editor";
import { RankingThumbnail } from "@/components/ranking-thumbnail";
import { Button } from "@/components/ui/button";
import { StatusBanner } from "@/components/ui/status-banner";
import { requireApproved } from "@/lib/auth";
import { getAllTopics, getMyTopic } from "@/lib/data/topics";
import { derivePollsState, getMyBallot, getVotingState } from "@/lib/data/voting";

interface PageProps {
  searchParams: Promise<{ focus?: string }>;
}

function fmtDateTime(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

function fmtDate(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    timeZone: "Asia/Manila",
  });
}

export const metadata: Metadata = { title: "Vote" };

export default async function Vote({ searchParams }: PageProps) {
  await requireApproved();
  const myTopic = await getMyTopic();
  // Eligibility: approved AND assigned topic. Non-voters (e.g. the
  // professor approved as non-voting admin) shouldn't see the ranking
  // page — quietly bounce them to the dashboard.
  if (!myTopic) redirect("/dashboard");

  const [allTopics, votingState, ballot, params] = await Promise.all([
    getAllTopics(),
    getVotingState(),
    getMyBallot(),
    searchParams,
  ]);

  // Unassigned topics aren't rankable — they still appear in the
  // dashboard gallery, but a voter can't drag/drop them into a ballot
  // because there's no presenter to vote for. Filter once here and
  // derive the editor's view from the filtered list.
  const topics = allTopics.filter((t) => t.state !== "unassigned");
  const rankableIds = new Set(topics.map((t) => t.id));

  const polls = derivePollsState(
    {
      polls_locked: votingState?.polls_locked ?? false,
      polls_open_at: votingState?.polls_open_at ?? null,
      deadline_at: votingState?.deadline_at ?? null,
    },
    new Date(),
  );

  const submitted = !!ballot?.submitted_at || !!ballot?.locked_at;
  // Defensive: if a pre-existing ranking happens to contain a topic
  // that has since been unassigned, drop it from the displayed list so
  // the editor doesn't render an undefined thumbnail. The voter's next
  // save will normalise the DB state.
  const ranked =
    ballot?.rankings
      .map((r) => r.topicId)
      .filter((id) => rankableIds.has(id)) ?? [];

  // Pre-render the thumbnails server-side and pass them through to the
  // client editor as a Map. Keeps signed-URL generation server-only.
  const thumbnails = new Map(
    topics.map((t) => [
      t.id,
      <RankingThumbnail key={t.id} topic={t} size={36} />,
    ]),
  );

  const focusTopicId = params.focus ? Number(params.focus) : undefined;

  // Lite topic shape for the client editor (no FK join, no signed URLs).
  const liteTopics = topics.map((t) => ({
    id: t.id,
    philosopher: t.philosopher,
    theme: t.theme,
  }));

  // ── Submitted (read-only) ─────────────────────────────────────────────
  if (polls === "open" && submitted) {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
        <Header />
        <div className="mb-5">
          <StatusBanner
            tone="neutral"
            title="Ballot submitted · locked"
            sub={
              ballot?.submitted_at
                ? `Locked at ${fmtDateTime(ballot.submitted_at)}.`
                : undefined
            }
          />
        </div>
        <ReadOnlyRanking
          ranked={ranked}
          topics={topics}
          thumbnails={thumbnails}
        />
      </div>
    );
  }

  // ── Polls closed ──────────────────────────────────────────────────────
  if (polls === "closed") {
    const tallyDone = !!votingState?.tally_run_at;
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
        <Header />
        <div className="mb-5">
          {tallyDone ? (
            <StatusBanner
              tone="success"
              title="Results are in"
              sub="View the top five."
              action={
                <Link href="/results">
                  <Button kind="primary">View results</Button>
                </Link>
              }
            />
          ) : (
            <StatusBanner
              tone="amber"
              title="Polls closed"
              sub="Awaiting the tally."
            />
          )}
        </div>
        <ReadOnlyRanking
          ranked={ranked}
          topics={topics}
          thumbnails={thumbnails}
        />
      </div>
    );
  }

  // ── Polls not open ────────────────────────────────────────────────────
  if (polls === "not_open") {
    return (
      <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
        <Header />
        <div className="mb-5">
          <StatusBanner
            tone="violet"
            title={
              votingState?.polls_open_at
                ? `Voting opens on ${fmtDate(votingState.polls_open_at)}`
                : "Voting opens on 5 May"
            }
            sub="Take notes meanwhile — the dashboard fills in as students present."
          />
        </div>
        <ReadOnlyRanking
          ranked={ranked}
          topics={topics}
          thumbnails={thumbnails}
        />
      </div>
    );
  }

  // ── Polls open + draft (the cornerstone interaction) ──────────────────
  return (
    <div className="max-w-[1200px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-32">
      <Header />
      {votingState?.deadline_at ? (
        <p className="text-text-2 mt-1 mb-5">
          Drag your favourites to the right. Order them most liked to least.
          Anything left in the unranked column counts as no preference.
          Voting closes {fmtDate(votingState.deadline_at)}.
        </p>
      ) : (
        <p className="text-text-2 mt-1 mb-5">
          Drag your favourites to the right. Order them most liked to least.
          Anything left in the unranked column counts as no preference.
        </p>
      )}
      <RankingEditor
        topics={liteTopics}
        thumbnails={thumbnails}
        initialRanked={ranked}
        totalTopics={topics.length}
        focusTopicId={focusTopicId}
      />
    </div>
  );
}

function Header() {
  return (
    <div className="flex items-baseline flex-wrap gap-3 mb-1">
      <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0">
        Your ballot
      </h1>
    </div>
  );
}

function ReadOnlyRanking({
  ranked,
  topics,
  thumbnails,
}: {
  ranked: number[];
  topics: { id: number; philosopher: string; theme: string }[];
  thumbnails: Map<number, React.ReactNode>;
}) {
  const byId = new Map(topics.map((t) => [t.id, t]));
  if (ranked.length === 0) {
    return (
      <div className="bg-white border border-dashed border-line rounded-lg p-10 text-center text-text-2">
        No rankings yet.
      </div>
    );
  }
  return (
    <div className="bg-white border border-line rounded-lg p-4 max-w-[640px]">
      <h3 className="m-0 mb-3 text-sm font-semibold">
        My ranking{" "}
        <span className="text-text-2 font-normal ml-1">{ranked.length}</span>
      </h3>
      {ranked.map((id, i) => {
        const t = byId.get(id);
        if (!t) return null;
        return (
          <div
            key={id}
            className={[
              "flex items-center gap-3 px-3 py-2.5 bg-white border border-line rounded mb-2",
              i === 0 ? "border-l-[3px] border-l-amber" : "",
            ].join(" ")}
          >
            <div className="font-mono tabular-nums text-sm font-semibold text-navy w-6 text-right">
              #{i + 1}
            </div>
            {thumbnails.get(id)}
            <div className="text-[13px] min-w-0 flex-1">
              <b className="font-serif font-semibold text-sm block truncate">
                {t.philosopher}
              </b>
              <span className="text-text-2 truncate">{t.theme}</span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
