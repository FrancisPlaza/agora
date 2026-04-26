import { describe, it, expect } from "vitest";
import { tally, Ballot, Topic, TallyResult } from "./irv";

// ── Helpers ────────────────────────────────────────────────────────────────

/** Build topics [{id:1,orderNum:1}, {id:2,orderNum:2}, ...] */
function makeTopics(n: number): Topic[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, orderNum: i + 1 }));
}

/** Create n identical ballots with the given ranking */
function makeBallots(n: number, topicIds: number[], voterPrefix = "v"): Ballot[] {
  return Array.from({ length: n }, (_, i) => ({
    voterId: `${voterPrefix}-${i}`,
    rankings: topicIds.map((id, rank) => ({ topicId: id, rank: rank + 1 })),
  }));
}

// ── Test 1: Clear winner, single round ─────────────────────────────────────

describe("Test 1 — Clear winner, single round", () => {
  it("elects topic 1 in run 1 round 1 with 100%", () => {
    const topics = makeTopics(3);
    const ballots = makeBallots(10, [1]);
    const result = tally(ballots, topics, 5);

    expect(result.totalBallots).toBe(10);
    expect(result.runs[0].winner).toBe(1);
    expect(result.runs[0].rounds).toHaveLength(1);
    expect(result.runs[0].finalShare).toBe(100);

    // Runs 2–5: no preferences left → winner = null
    for (let i = 1; i < 5; i++) {
      expect(result.runs[i].winner).toBeNull();
    }
  });
});

// ── Test 2: Standard IRV elimination ──────────────────────────────────────

describe("Test 2 — Standard IRV elimination", () => {
  it("eliminates via tie-break, transfers votes correctly", () => {
    const topics = makeTopics(3);
    const ballots = [
      ...makeBallots(4, [1, 2, 3], "a"),
      ...makeBallots(3, [2, 1, 3], "b"),
      ...makeBallots(3, [3, 2, 1], "c"),
    ];
    const result = tally(ballots, topics, 3);

    // Run 1
    const run1 = result.runs[0];
    expect(run1.rounds).toHaveLength(2);
    // Round 1: 1=4, 2=3, 3=3. Tied lowest → eliminate 3 (higher orderNum)
    expect(run1.rounds[0].eliminated).toBe(3);
    // Round 2: 1=4, 2=6. Winner = 2
    expect(run1.winner).toBe(2);
    expect(run1.finalShare).toBe(60);

    // Run 2 (active = {1, 3})
    const run2 = result.runs[1];
    expect(run2.winner).toBe(1);
    expect(run2.finalShare).toBe(70);

    // Run 3 (active = {3})
    const run3 = result.runs[2];
    expect(run3.winner).toBe(3);
    expect(run3.finalShare).toBe(100);
  });
});

// ── Test 3: Tied lowest, tie-break works ──────────────────────────────────

describe("Test 3 — Tied lowest, tie-break works", () => {
  it("breaks three-way tie by eliminating highest orderNum", () => {
    const topics = makeTopics(3);
    const ballots = [
      ...makeBallots(3, [1], "a"),
      ...makeBallots(3, [2], "b"),
      ...makeBallots(3, [3], "c"),
    ];
    const result = tally(ballots, topics, 3);

    const run1 = result.runs[0];
    // Round 1: all tied at 3. Eliminate 3
    expect(run1.rounds[0].eliminated).toBe(3);
    // Round 2: 1=3, 2=3. Eliminate 2
    expect(run1.rounds[1].eliminated).toBe(2);
    // Round 3: 1=3. Winner (single candidate with votes)
    expect(run1.rounds).toHaveLength(3);
    expect(run1.winner).toBe(1);

    // Run 2 (active = {2,3}): 3 ballots [1] exhaust, 3 vote for 2, 3 vote for 3.
    // Tie → eliminate 3 → winner = 2.
    // (Spec walkthrough incorrectly says all ballots exhaust; only the [1] group does.)
    expect(result.runs[1].winner).toBe(2);

    // Run 3 (active = {3}): 3 ballots vote for 3 → winner = 3.
    expect(result.runs[2].winner).toBe(3);
  });
});

// ── Test 4: Partial rankings with transfers ───────────────────────────────

describe("Test 4 — Partial rankings with transfers", () => {
  it("handles partial rankings and exhaustion correctly", () => {
    const topics = makeTopics(4);
    const ballots = [
      ...makeBallots(5, [1, 2], "a"),
      ...makeBallots(5, [2, 1], "b"),
      ...makeBallots(3, [3, 4], "c"),
      ...makeBallots(2, [4], "d"),
    ];
    const result = tally(ballots, topics, 4);

    const run1 = result.runs[0];
    // Round 1: 1=5, 2=5, 3=3, 4=2. Eliminate 4
    expect(run1.rounds[0].eliminated).toBe(4);
    // Round 2: 1=5, 2=5, 3=3. 2 ballots exhausted. Eliminate 3
    expect(run1.rounds[1].eliminated).toBe(3);
    // Round 3: 1=5, 2=5. 3 more exhaust (3→4 path). Tie → eliminate 2
    expect(run1.rounds[2].eliminated).toBe(2);
    // Round 4: 1 wins with all remaining
    expect(run1.winner).toBe(1);
    expect(run1.rounds).toHaveLength(4);
  });
});

// ── Test 5: Empty ballot ──────────────────────────────────────────────────

describe("Test 5 — Empty ballot", () => {
  it("empty ballots are always exhausted", () => {
    const topics = makeTopics(2);
    const ballots = [
      ...makeBallots(3, [1, 2], "a"),
      ...makeBallots(3, [2, 1], "b"),
      ...makeBallots(4, [], "e"),
    ];
    const result = tally(ballots, topics, 2);

    const run1 = result.runs[0];
    // Round 1: 1=3, 2=3, 4 exhausted. Eliminate 2
    expect(run1.rounds[0].exhausted).toBe(4);
    expect(run1.rounds[0].eliminated).toBe(2);
    // Round 2: 1=6. Winner
    expect(run1.winner).toBe(1);

    // Run 2 (active = {2}): 6 voters have pref for 2
    const run2 = result.runs[1];
    expect(run2.winner).toBe(2);
  });
});

// ── Test 6: Self-vote not special ─────────────────────────────────────────

describe("Test 6 — Self-vote not special", () => {
  it("produces same result regardless of voter identity", () => {
    const topics = makeTopics(3);

    // Ballot from "self" (the presenter of topic 1) ranking their own topic
    const ballotsWithSelf: Ballot[] = [
      { voterId: "presenter-of-1", rankings: [{ topicId: 1, rank: 1 }, { topicId: 2, rank: 2 }] },
      ...makeBallots(4, [1, 2, 3], "a"),
      ...makeBallots(3, [2, 3, 1], "b"),
    ];

    // Same ballot but from a non-presenter
    const ballotsWithout: Ballot[] = [
      { voterId: "random-voter", rankings: [{ topicId: 1, rank: 1 }, { topicId: 2, rank: 2 }] },
      ...makeBallots(4, [1, 2, 3], "a"),
      ...makeBallots(3, [2, 3, 1], "b"),
    ];

    const r1 = tally(ballotsWithSelf, topics, 3);
    const r2 = tally(ballotsWithout, topics, 3);

    // Same winners
    for (let i = 0; i < 3; i++) {
      expect(r1.runs[i].winner).toBe(r2.runs[i].winner);
    }
  });
});

// ── Test 7: Idempotence ──────────────────────────────────────────────────

describe("Test 7 — Idempotence", () => {
  it("returns deeply-equal results on repeated calls (modulo computedAt)", () => {
    const topics = makeTopics(3);
    const ballots = [
      ...makeBallots(4, [1, 2, 3], "a"),
      ...makeBallots(3, [2, 1, 3], "b"),
      ...makeBallots(3, [3, 2, 1], "c"),
    ];

    const r1 = tally(ballots, topics, 3);
    const r2 = tally(ballots, topics, 3);

    // Compare everything except computedAt
    const strip = (r: TallyResult) => ({ ...r, computedAt: undefined });
    expect(strip(r1)).toEqual(strip(r2));
  });
});

// ── Test 8: Ordering invariance ──────────────────────────────────────────

describe("Test 8 — Ordering invariance", () => {
  it("ballot and topic input order does not affect result", () => {
    const topics = makeTopics(4);
    const topicsReversed = [...topics].reverse();

    const ballots = [
      ...makeBallots(5, [1, 2], "a"),
      ...makeBallots(5, [2, 1], "b"),
      ...makeBallots(3, [3, 4], "c"),
      ...makeBallots(2, [4], "d"),
    ];
    const ballotsReversed = [...ballots].reverse();

    const r1 = tally(ballots, topics, 4);
    const r2 = tally(ballotsReversed, topicsReversed, 4);

    const strip = (r: TallyResult) => ({ ...r, computedAt: undefined });
    expect(strip(r1)).toEqual(strip(r2));
  });
});

// ── Test 9: Larger realistic scenario ────────────────────────────────────

describe("Test 9 — Larger realistic scenario (32 topics, 30 ballots)", () => {
  it("matches snapshot", () => {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const seedrandom = require("seedrandom");
    const rng = seedrandom("agora-irv-test-seed-42");

    const topics = makeTopics(32);
    const ballots: Ballot[] = [];

    for (let v = 0; v < 30; v++) {
      // Each voter ranks between 5 and 20 topics
      const rankingLength = 5 + Math.floor(rng() * 16);
      // Shuffle topic ids and take first rankingLength
      const shuffled = topics
        .map((t) => t.id)
        .sort(() => rng() - 0.5);
      const ranked = shuffled.slice(0, rankingLength);
      ballots.push({
        voterId: `voter-${v}`,
        rankings: ranked.map((id, i) => ({ topicId: id, rank: i + 1 })),
      });
    }

    const result = tally(ballots, topics, 5);

    // Snapshot the winners and round counts for regression
    const snapshot = {
      winners: result.runs.map((r) => r.winner),
      roundCounts: result.runs.map((r) => r.rounds.length),
      finalShares: result.runs.map((r) => r.finalShare),
      totalBallots: result.totalBallots,
      topicsCount: result.topicsCount,
    };

    expect(snapshot).toMatchSnapshot();
  });
});

// ── Test 10: All ballots exhausted in run 4 ──────────────────────────────

describe("Test 10 — All ballots exhausted in run 4", () => {
  it("runs 1-3 produce winners, runs 4-5 are vacant", () => {
    const topics = makeTopics(5);
    const ballots = [
      ...makeBallots(10, [1, 2, 3], "a"),
      ...makeBallots(10, [2, 3, 1], "b"),
      ...makeBallots(10, [3, 1, 2], "c"),
    ];
    const result = tally(ballots, topics, 5);

    // Runs 1-3 should produce winners from {1, 2, 3}
    const firstThreeWinners = result.runs.slice(0, 3).map((r) => r.winner);
    expect(firstThreeWinners.sort()).toEqual([1, 2, 3]);

    // Runs 4-5: all ballots exhausted → null
    expect(result.runs[3].winner).toBeNull();
    expect(result.runs[4].winner).toBeNull();
  });
});
