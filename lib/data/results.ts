import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { RoundResult } from "@/lib/irv";
import type { TopicView } from "@/lib/data/topics";

interface ResultsRunRow {
  run_num: number;
  winner_topic_id: number | null;
  rounds: RoundResult[];
  total_ballots: number;
  exhausted: number;
  created_at: string;
}

export interface ResultsRunView {
  runNum: number;
  winner: TopicView | null;
  rounds: RoundResult[];
  totalBallots: number;
  exhausted: number;
  /**
   * The winning candidate's share of non-exhausted ballots in the final
   * round. Computed from the rounds[last] entry. Zero for vacant runs.
   */
  finalShare: number;
}

export interface ResultsView {
  runs: ResultsRunView[];
  tallyRunAt: string | null;
  /** Sum of `run.rounds.length` across every run. */
  totalRounds: number;
}

interface TopicLookupRow {
  id: number;
  order_num: number;
  philosopher: string;
  theme: string;
  presenter_voter_id: string | null;
  scheduled_for: string | null;
  presented_at: string | null;
  art_title: string | null;
  art_explanation: string | null;
  art_image_path: string | null;
  art_uploaded_at: string | null;
  created_at: string;
  updated_at: string;
  presenter: { id: string; full_name: string } | null;
}

function deriveState(
  t: Pick<
    TopicLookupRow,
    "presenter_voter_id" | "presented_at" | "art_uploaded_at"
  >,
): TopicView["state"] {
  if (!t.presenter_voter_id) return "unassigned";
  if (!t.presented_at) return "assigned";
  if (!t.art_uploaded_at) return "presented";
  return "published";
}

function toTopicView(row: TopicLookupRow, classNoteCount: number): TopicView {
  return {
    ...row,
    state: deriveState(row),
    presenter: row.presenter,
    class_note_count: classNoteCount,
  };
}

function buildNoteCountMap(
  rows: ReadonlyArray<{ topic_id: number }> | null,
): Map<number, number> {
  const map = new Map<number, number>();
  for (const row of rows ?? []) {
    map.set(row.topic_id, (map.get(row.topic_id) ?? 0) + 1);
  }
  return map;
}

/**
 * Reads `tally_results` ordered by run_num, joins each winner topic to
 * its full TopicView shape (presenter via FK embed) for the podium, and
 * stitches `tally_run_at` from `voting_state`.
 *
 * Returns `null` if `tally_results` is empty (no tally has been run yet).
 * Empty state is the "results not posted" UI signal — both the dashboard
 * banner state machine and the results page key off this.
 */
export const getResults = cache(async (): Promise<ResultsView | null> => {
  const supabase = await createClient();

  const [tallyResult, votingResult] = await Promise.all([
    supabase
      .from("tally_results")
      .select("run_num, winner_topic_id, rounds, total_ballots, exhausted, created_at")
      .order("run_num", { ascending: true }),
    supabase.from("voting_state").select("tally_run_at").eq("id", 1).maybeSingle(),
  ]);

  const rawRuns = (tallyResult.data ?? []) as unknown as ResultsRunRow[];
  if (rawRuns.length === 0) return null;

  // Single fetch for all winner topics to avoid an N+1 across 1..5 runs.
  const winnerIds = rawRuns
    .map((r) => r.winner_topic_id)
    .filter((id): id is number => id != null);

  let winnerById = new Map<number, TopicView>();
  if (winnerIds.length > 0) {
    const [topicsRes, countsRes] = await Promise.all([
      supabase
        .from("topics")
        .select(
          "*, presenter:profiles!presenter_voter_id(id, full_name)",
        )
        .in("id", winnerIds),
      supabase
        .from("notes")
        .select("topic_id")
        .eq("visibility", "class")
        .in("topic_id", winnerIds),
    ]);
    const counts = buildNoteCountMap(countsRes.data);
    winnerById = new Map(
      ((topicsRes.data ?? []) as unknown as TopicLookupRow[]).map((t) => [
        t.id,
        toTopicView(t, counts.get(t.id) ?? 0),
      ]),
    );
  }

  const runs: ResultsRunView[] = rawRuns.map((row) => {
    const winner = row.winner_topic_id != null
      ? (winnerById.get(row.winner_topic_id) ?? null)
      : null;
    const lastRound = row.rounds[row.rounds.length - 1];
    const winnerEntry = lastRound?.candidates.find(
      (c) => c.topicId === row.winner_topic_id,
    );
    return {
      runNum: row.run_num,
      winner,
      rounds: row.rounds,
      totalBallots: row.total_ballots,
      exhausted: row.exhausted,
      finalShare: winnerEntry?.pct ?? 0,
    };
  });

  return {
    runs,
    tallyRunAt: votingResult.data?.tally_run_at ?? null,
    totalRounds: runs.reduce((sum, r) => sum + r.rounds.length, 0),
  };
});

/**
 * Returns a `Map<topicId, TopicView>` for every topic referenced anywhere
 * in the results — winners plus every candidate in every round of every
 * run. Lets the round-by-round display look up philosopher names and
 * artwork paths without N+1 queries inside the timeline render.
 */
export const getResultsTopicMap = cache(
  async (): Promise<Map<number, TopicView>> => {
    const supabase = await createClient();
    const { data: rawRuns } = await supabase
      .from("tally_results")
      .select("rounds, winner_topic_id");
    if (!rawRuns || rawRuns.length === 0) return new Map();

    const ids = new Set<number>();
    for (const row of rawRuns as unknown as Array<{
      rounds: RoundResult[];
      winner_topic_id: number | null;
    }>) {
      if (row.winner_topic_id != null) ids.add(row.winner_topic_id);
      for (const round of row.rounds) {
        for (const c of round.candidates) ids.add(c.topicId);
      }
    }
    if (ids.size === 0) return new Map();
    const idArray = Array.from(ids);

    const [topicsRes, countsRes] = await Promise.all([
      supabase
        .from("topics")
        .select("*, presenter:profiles!presenter_voter_id(id, full_name)")
        .in("id", idArray),
      supabase
        .from("notes")
        .select("topic_id")
        .eq("visibility", "class")
        .in("topic_id", idArray),
    ]);
    const counts = buildNoteCountMap(countsRes.data);

    return new Map(
      ((topicsRes.data ?? []) as unknown as TopicLookupRow[]).map((t) => [
        t.id,
        toTopicView(t, counts.get(t.id) ?? 0),
      ]),
    );
  },
);
