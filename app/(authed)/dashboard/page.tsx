import Link from "next/link";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Chips } from "@/components/ui/chips";
import { StatusBanner, type BannerTone } from "@/components/ui/status-banner";
import { TopicCard, type Medal } from "@/components/topic-card";
import { getAllTopics, getMyTopic, type TopicState } from "@/lib/data/topics";
import { getMyNotedTopics } from "@/lib/data/notes";
import { getResults } from "@/lib/data/results";
import {
  derivePollsState,
  getMyBallot,
  getVotingState,
} from "@/lib/data/voting";

type Filter = "all" | "published" | "presented" | "unassigned" | "mynotes";

const FILTERS: Filter[] = ["all", "published", "presented", "unassigned", "mynotes"];
const FILTER_LABEL: Record<Filter, string> = {
  all: "All",
  published: "Published",
  presented: "Presented",
  unassigned: "Unassigned",
  mynotes: "My notes",
};

interface PageProps {
  searchParams: Promise<{ filter?: string }>;
}

export default async function Dashboard({ searchParams }: PageProps) {
  const params = await searchParams;
  const filterParam = (params.filter ?? "all") as Filter;
  const filter: Filter = FILTERS.includes(filterParam) ? filterParam : "all";

  const [topics, myTopic, myNotedTopics, votingState, ballot, results] =
    await Promise.all([
      getAllTopics(),
      getMyTopic(),
      getMyNotedTopics(),
      getVotingState(),
      getMyBallot(),
      getResults(),
    ]);

  // Build medal map (gold/silver/bronze/4/5) from the tally winners.
  // Vacant runs (winner === null) skip — no medal for that position.
  const medalByTopicId = new Map<number, Medal>();
  if (results) {
    for (const run of results.runs) {
      if (run.winner && run.runNum >= 1 && run.runNum <= 5) {
        medalByTopicId.set(run.winner.id, run.runNum as Medal);
      }
    }
  }
  const topWinner = results?.runs[0]?.winner ?? null;

  const polls = derivePollsState(
    {
      polls_locked: votingState?.polls_locked ?? false,
      polls_open_at: votingState?.polls_open_at ?? null,
      deadline_at: votingState?.deadline_at ?? null,
    },
    new Date(),
  );

  const myNotedSet = new Set(myNotedTopics);

  const counts = {
    all: topics.length,
    published: topics.filter((t) => t.state === "published").length,
    presented: topics.filter((t) => t.state === "presented").length,
    unassigned: topics.filter((t) => t.state === "unassigned").length,
    mynotes: topics.filter((t) => myNotedSet.has(t.id)).length,
  };

  const visible = topics.filter((t) => {
    if (filter === "all") return true;
    if (filter === "mynotes") return myNotedSet.has(t.id);
    return t.state === filter;
  });

  const banner = pickBanner({
    myTopicState: myTopic?.state ?? null,
    myTopicId: myTopic?.id ?? null,
    myTopicPhilosopher: myTopic?.philosopher ?? null,
    myTopicArtUploadedAt: myTopic?.art_uploaded_at ?? null,
    polls,
    submitted: !!ballot?.submitted_at || !!ballot?.locked_at,
    rankedCount: ballot?.rankings.length ?? 0,
    totalTopics: topics.length,
    deadlineAt: votingState?.deadline_at ?? null,
    submittedAt: ballot?.submitted_at ?? null,
    resultsPosted: !!results && results.runs.some((r) => r.winner != null),
    topWinnerName: topWinner?.philosopher ?? null,
  });

  const publishedCount = counts.published;

  return (
    <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-4 md:py-6 pb-10">
      <div className="flex items-baseline flex-wrap gap-3 mb-5">
        <h1 className="font-serif text-2xl md:text-3xl font-semibold tracking-tight m-0">
          Class Gallery
        </h1>
        <div className="text-text-2 text-[13px]">
          JDN101 · {publishedCount} of {topics.length} published
        </div>
      </div>

      <div className="mb-5">
        <StatusBanner {...banner} />
      </div>

      <div className="mb-4">
        <Chips
          paramKey="filter"
          defaultId="all"
          items={FILTERS.map((id) => ({
            id,
            label: FILTER_LABEL[id],
            count: counts[id],
          }))}
        />
      </div>

      {visible.length === 0 ? (
        <div className="bg-white border border-dashed border-line rounded-lg p-10 text-center text-text-2">
          No topics match this filter.
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((t) => (
            <TopicCard
              key={t.id}
              topic={t}
              isMine={t.id === myTopic?.id}
              medal={medalByTopicId.get(t.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface BannerProps {
  myTopicState: TopicState | null;
  myTopicId: number | null;
  myTopicPhilosopher: string | null;
  myTopicArtUploadedAt: string | null;
  polls: ReturnType<typeof derivePollsState>;
  submitted: boolean;
  rankedCount: number;
  totalTopics: number;
  deadlineAt: string | null;
  submittedAt: string | null;
  resultsPosted: boolean;
  topWinnerName: string | null;
}

interface BannerSpec {
  tone: BannerTone;
  title: string;
  sub?: string;
  action?: ReactNode;
}

function fmtDate(input: string | null): string {
  if (!input) return "soon";
  return new Date(input).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
  });
}

function fmtDateTime(input: string | null): string {
  if (!input) return "";
  return new Date(input).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * Banner precedence — Phase 7.6 splits the presenter cases. Order:
 *   1. presenter-amber: my topic is 'presented' (beadle marked) — upload prompt
 *   2. presenter-violet: my topic is 'assigned', no art yet     — soft early-upload prompt
 *   3. presenter-violet: my topic is 'assigned', art uploaded   — confirmation, edit-only
 *   4. results-posted (tally has run with a winner)             — success-green
 *   5. polls=closed (regardless of submission)                  — amber tally-in-progress
 *   6. polls=open + submitted                                   — neutral submitted
 *   7. polls=open + draft                                       — violet voting-open
 *   8. fallback                                                 — violet take-notes
 *
 * The amber-presenter variant still wins over polls-related variants;
 * the two new violet sub-cases are softer and slot just below it.
 */
function pickBanner({
  myTopicState,
  myTopicId,
  myTopicPhilosopher,
  myTopicArtUploadedAt,
  polls,
  submitted,
  rankedCount,
  totalTopics,
  deadlineAt,
  submittedAt,
  resultsPosted,
  topWinnerName,
}: BannerProps): BannerSpec {
  if (myTopicState === "presented" && myTopicId != null) {
    return {
      tone: "amber",
      title: "Your turn — upload your presentation",
      sub: "Add your art and a 5-7 sentence explanation so it appears in the gallery.",
      action: (
        <Link href={`/topic/${myTopicId}/upload`}>
          <Button kind="primary">Upload now</Button>
        </Link>
      ),
    };
  }

  if (myTopicState === "assigned" && myTopicId != null) {
    if (!myTopicArtUploadedAt) {
      return {
        tone: "violet",
        title: myTopicPhilosopher
          ? `You're presenting ${myTopicPhilosopher}.`
          : "You're presenting soon.",
        sub: "You can upload your art early — it'll appear in the gallery once your beadle marks you presented.",
        action: (
          <Link href={`/topic/${myTopicId}/upload`}>
            <Button kind="primary">Upload now</Button>
          </Link>
        ),
      };
    }
    return {
      tone: "violet",
      title: "Your art is ready.",
      sub: "It'll appear in the gallery once your beadle marks you presented.",
      action: (
        <Link href={`/topic/${myTopicId}/upload`}>
          <Button kind="secondary">Edit upload</Button>
        </Link>
      ),
    };
  }

  if (resultsPosted) {
    return {
      tone: "success",
      title: "Results are in.",
      sub: topWinnerName
        ? `The class voted ${topWinnerName} best presentation. See the top five.`
        : "See the top five.",
      action: (
        <Link href="/results">
          <Button kind="primary">View results</Button>
        </Link>
      ),
    };
  }

  if (polls === "closed") {
    return {
      tone: "amber",
      title: "Polls closed · Tally in progress",
      sub: "Results land here once the beadle runs the count.",
    };
  }

  if (polls === "open" && submitted) {
    return {
      tone: "neutral",
      title: "Ballot submitted",
      sub: submittedAt
        ? `Locked at ${fmtDateTime(submittedAt)}. Results post when polls close on ${fmtDate(deadlineAt)}.`
        : "Results post when polls close.",
      action: (
        <Link href="/vote">
          <Button kind="secondary">View ranking</Button>
        </Link>
      ),
    };
  }

  if (polls === "open") {
    return {
      tone: "violet",
      title: `Voting open until ${fmtDate(deadlineAt)}`,
      sub: `You've ranked ${rankedCount} of ${totalTopics}. Your draft saves automatically.`,
      action: (
        <Link href="/vote">
          <Button kind="primary">Continue ranking</Button>
        </Link>
      ),
    };
  }

  return {
    tone: "violet",
    title: "Take notes as presentations happen",
    sub: "They're private until you flip the switch.",
  };
}
