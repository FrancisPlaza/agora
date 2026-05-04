import type { Metadata } from "next";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs } from "@/components/ui/tabs";
import { requireApproved } from "@/lib/auth";
import { getResults, getResultsTopicMap } from "@/lib/data/results";
import { Podium } from "./podium";
import { PrintButton } from "./print-button";
import { RunTimeline } from "./run-timeline";

interface PageProps {
  searchParams: Promise<{ run?: string }>;
}

const RESULTS_BG: React.CSSProperties = {
  background: [
    "radial-gradient(ellipse 60% 70% at 20% 0%, rgba(99,91,255,0.10), transparent 55%)",
    "radial-gradient(ellipse 50% 60% at 90% 10%, rgba(184,134,11,0.10), transparent 55%)",
    "linear-gradient(180deg, #FFFFFF, #F6F9FC)",
  ].join(", "),
};

function fmtDateTime(input: string | null): string {
  if (!input) return "—";
  return new Date(input).toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Manila",
  });
}

export const metadata: Metadata = { title: "Results" };

export default async function Results({ searchParams }: PageProps) {
  const profile = await requireApproved();
  const [results, topicMap, params] = await Promise.all([
    getResults(),
    getResultsTopicMap(),
    searchParams,
  ]);

  // Empty state — no tally has run yet.
  if (!results || results.runs.length === 0) {
    return (
      <div className="min-h-dvh" style={RESULTS_BG}>
        <div className="max-w-[640px] mx-auto px-4 md:px-8 py-10 text-center">
          <h1 className="font-serif text-3xl font-semibold tracking-tight mb-2">
            Results aren&rsquo;t in yet
          </h1>
          <p className="text-text-2 mb-6">
            {profile.is_admin
              ? "Lock ballots and run the tally from Voting controls."
              : "Results post here once your beadle runs the tally."}
          </p>
          {profile.is_admin ? (
            <Link href="/admin/voting">
              <Button kind="primary">Go to voting controls</Button>
            </Link>
          ) : (
            <Link href="/dashboard">
              <Button kind="secondary">Back to dashboard</Button>
            </Link>
          )}
        </div>
      </div>
    );
  }

  const requestedRun = Number(params.run ?? "1");
  const activeRunNum =
    Number.isFinite(requestedRun) && requestedRun >= 1 && requestedRun <= results.runs.length
      ? requestedRun
      : 1;
  const activeRun =
    results.runs.find((r) => r.runNum === activeRunNum) ?? results.runs[0];

  const totalBallots = results.runs[0]?.totalBallots ?? 0;

  return (
    <div className="min-h-dvh" data-results-page style={RESULTS_BG}>
      <div className="max-w-[1240px] mx-auto px-4 md:px-8 py-6 md:py-8">
        {/* Header strip */}
        <div className="flex items-center gap-3 mb-2 print:hidden">
          {profile.is_admin ? (
            <Badge tone="navy" icon="shield">
              Beadle
            </Badge>
          ) : null}
          <span className="text-text-2 text-[13px]">
            Tally completed · {fmtDateTime(results.tallyRunAt)}
          </span>
          <div className="flex-1" />
          <a href="/api/results/top-5.csv">
            <Button kind="secondary" size="sm" icon="external">
              Top 5 CSV
            </Button>
          </a>
          <a href="/api/results/rounds.csv">
            <Button kind="secondary" size="sm" icon="external">
              Rounds CSV
            </Button>
          </a>
          <PrintButton />
        </div>

        {/* Hero */}
        <h1 className="font-serif text-3xl md:text-[42px] font-semibold tracking-tight m-0 mt-2 mb-1.5 leading-tight">
          The class chose its top five.
        </h1>
        <p className="text-text-2 mb-7">
          Sequential IRV across {totalBallots}{" "}
          {totalBallots === 1 ? "ballot" : "ballots"} · {results.totalRounds}{" "}
          {results.totalRounds === 1 ? "round" : "rounds"} total.
        </p>

        {/* Podium */}
        <Podium runs={results.runs} />

        {/* Run tabs + active timeline */}
        <div className="bg-white border border-line rounded-lg overflow-hidden">
          <div className="px-3 print:hidden">
            <Tabs
              paramKey="run"
              defaultId="1"
              items={results.runs.map((r) => ({
                id: String(r.runNum),
                label:
                  r.winner != null
                    ? `Run ${r.runNum} · ${r.winner.philosopher}`
                    : `Run ${r.runNum} · vacant`,
              }))}
            />
          </div>
          <div className="p-4 md:p-6">
            <div className="hidden print:block mb-4 font-serif text-xl font-semibold">
              Run {activeRun.runNum}
              {activeRun.winner ? ` — ${activeRun.winner.philosopher}` : ""}
            </div>
            <RunTimeline run={activeRun} topicMap={topicMap} />
          </div>
        </div>
      </div>
    </div>
  );
}
