/**
 * Sequential instant-runoff voting (IRV) algorithm.
 * Pure function — no I/O, no randomness, no time dependencies.
 * See specs/irv-spec.md for the full specification.
 */

// ── Types ──────────────────────────────────────────────────────────────────

export interface Ballot {
  voterId: string;
  rankings: Array<{ topicId: number; rank: number }>; // sorted by rank ascending
}

export interface Topic {
  id: number;
  orderNum: number;
}

export interface CandidateResult {
  topicId: number;
  votes: number;
  pct: number; // share of non-exhausted ballots, 0–100, rounded to 1dp
}

export interface RoundResult {
  round: number;
  candidates: CandidateResult[]; // sorted by votes desc, then orderNum asc
  exhausted: number;
  totalActive: number;
  eliminated: number | null;
  winner: number | null;
}

export interface RunResult {
  position: number; // 1..5
  winner: number | null;
  rounds: RoundResult[];
  finalShare: number; // winner's % of non-exhausted in final round; 0 if failed
}

export interface TallyResult {
  runs: RunResult[];
  totalBallots: number;
  topicsCount: number;
  computedAt: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function round1dp(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Build a lookup from topicId → orderNum for tie-breaking. */
function buildOrderMap(topics: Topic[]): Map<number, number> {
  const m = new Map<number, number>();
  for (const t of topics) {
    m.set(t.id, t.orderNum);
  }
  return m;
}

/**
 * Sort candidates by votes descending, then by orderNum ascending (stable display order).
 */
function sortCandidates(
  candidates: CandidateResult[],
  orderMap: Map<number, number>,
): CandidateResult[] {
  return [...candidates].sort((a, b) => {
    if (b.votes !== a.votes) return b.votes - a.votes;
    return (orderMap.get(a.topicId) ?? 0) - (orderMap.get(b.topicId) ?? 0);
  });
}

// ── Single IRV run ─────────────────────────────────────────────────────────

function runSingleIRV(
  ballots: Ballot[],
  activeCandidates: Set<number>,
  orderMap: Map<number, number>,
): { winner: number | null; rounds: RoundResult[]; finalShare: number } {
  const eliminated = new Set<number>();
  const rounds: RoundResult[] = [];

  // Pre-compute each ballot's active ranking (preferences filtered to activeCandidates)
  const activeRankings: number[][] = ballots.map((b) =>
    b.rankings
      .slice()
      .sort((a, b) => a.rank - b.rank)
      .map((r) => r.topicId)
      .filter((id) => activeCandidates.has(id)),
  );

  let roundNum = 0;

  while (true) {
    roundNum++;

    // Count top preferences
    const voteCounts = new Map<number, number>();
    for (const id of activeCandidates) {
      if (!eliminated.has(id)) {
        voteCounts.set(id, 0);
      }
    }

    let exhaustedCount = 0;

    for (const ranking of activeRankings) {
      const topPref = ranking.find((id) => !eliminated.has(id));
      if (topPref === undefined) {
        exhaustedCount++;
      } else {
        voteCounts.set(topPref, (voteCounts.get(topPref) ?? 0) + 1);
      }
    }

    const totalActive = ballots.length - exhaustedCount;

    // Build candidate results
    const candidateResults: CandidateResult[] = [];
    for (const [topicId, votes] of voteCounts) {
      candidateResults.push({
        topicId,
        votes,
        pct: totalActive > 0 ? round1dp((votes / totalActive) * 100) : 0,
      });
    }

    const sorted = sortCandidates(candidateResults, orderMap);

    // Check if all candidates eliminated / all exhausted
    if (sorted.length === 0 || totalActive === 0) {
      rounds.push({
        round: roundNum,
        candidates: sorted,
        exhausted: exhaustedCount,
        totalActive,
        eliminated: null,
        winner: null,
      });
      return { winner: null, rounds, finalShare: 0 };
    }

    // Check for majority
    const majority = totalActive / 2;
    const leader = sorted[0];

    if (leader.votes > majority) {
      rounds.push({
        round: roundNum,
        candidates: sorted,
        exhausted: exhaustedCount,
        totalActive,
        eliminated: null,
        winner: leader.topicId,
      });
      return { winner: leader.topicId, rounds, finalShare: leader.pct };
    }

    // Single candidate left with at least one vote → wins
    if (sorted.length === 1 && sorted[0].votes > 0) {
      rounds.push({
        round: roundNum,
        candidates: sorted,
        exhausted: exhaustedCount,
        totalActive,
        eliminated: null,
        winner: sorted[0].topicId,
      });
      return { winner: sorted[0].topicId, rounds, finalShare: sorted[0].pct };
    }

    // Find the candidate with fewest votes — eliminate highest orderNum among tied lowest
    const minVotes = sorted[sorted.length - 1].votes;
    const tiedLowest = sorted.filter((c) => c.votes === minVotes);

    // Eliminate the one with the highest orderNum (i.e. preserve lower-numbered topics)
    const toEliminate = tiedLowest.reduce((worst, c) => {
      const worstOrder = orderMap.get(worst.topicId) ?? 0;
      const cOrder = orderMap.get(c.topicId) ?? 0;
      return cOrder > worstOrder ? c : worst;
    });

    eliminated.add(toEliminate.topicId);

    rounds.push({
      round: roundNum,
      candidates: sorted,
      exhausted: exhaustedCount,
      totalActive,
      eliminated: toEliminate.topicId,
      winner: null,
    });
  }
}

// ── Sequential IRV (full tally) ───────────────────────────────────────────

export function tally(
  ballots: Ballot[],
  topics: Topic[],
  positions: number = 5,
): TallyResult {
  const orderMap = buildOrderMap(topics);
  const elected: (number | null)[] = [];
  const runs: RunResult[] = [];

  for (let runNum = 1; runNum <= positions; runNum++) {
    const activeCandidates = new Set(
      topics.map((t) => t.id).filter((id) => !elected.includes(id)),
    );

    const result = runSingleIRV(ballots, activeCandidates, orderMap);

    runs.push({
      position: runNum,
      winner: result.winner,
      rounds: result.rounds,
      finalShare: result.finalShare,
    });

    elected.push(result.winner);
  }

  return {
    runs,
    totalBallots: ballots.length,
    topicsCount: topics.length,
    computedAt: new Date().toISOString(),
  };
}
