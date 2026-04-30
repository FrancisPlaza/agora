# Agora — Sequential IRV Specification

The tally algorithm. The single highest-stakes piece of logic in the system. Implement first, with passing tests, before any UI work touches it.

---

## What we're computing

We're producing the **top 5** presentations as ranked by the class. We use **sequential instant-runoff voting (IRV)**: run IRV to find the #1 winner, remove that topic from every ballot, run IRV again to find #2, and so on for 5 runs.

Voters submit a partial ranking — they may have ranked anywhere from 0 to 32 topics. Unranked topics count as no preference (the ballot exhausts when its last preference is eliminated).

---

## Definitions

- **Ballot.** A submitted vote: an ordered list of topic IDs reflecting the voter's preferences from best to worst. Length 0 to 32. Each topic appears at most once.
- **Active candidates.** In a given run, the set of topics not yet elected by a previous run.
- **Active ranking.** A ballot's preferences filtered to active candidates, preserving order.
- **Top preference.** The first topic in a ballot's active ranking that has not yet been eliminated in the current run.
- **Exhausted ballot.** A ballot whose active ranking has been entirely eliminated; contributes nothing to the current round's count.
- **Round.** One pass of counting top preferences; ends with either a winner or an elimination.
- **Run.** A full IRV procedure that elects one topic.
- **Tally.** The full procedure: 5 sequential runs, producing up to 5 winners.

---

## Single IRV run

Given:

- `activeCandidates`: set of topic IDs eligible in this run
- `ballots`: all submitted ballots

Procedure:

1. **Initialise.** Set `eliminated = {}` for this run. Each ballot's *top preference* is the first topic in its ranking that is in `activeCandidates` and not in `eliminated`.

2. **Round.** For each ballot, find its top preference. If the ballot has none, it's exhausted in this round. Tally votes per candidate.

3. **Check majority.** Let `nonExhausted = total ballots − exhausted`. A candidate wins this run if their votes `> nonExhausted / 2` (strict majority of active ballots).

4. **If a winner exists**: record the run, return. The winner is added to the elected set; the run terminates.

5. **If no winner**: find the candidate with the fewest votes. Eliminate them (add to `eliminated`). Loop to step 2.

6. **Termination.** A run terminates with a winner OR with no candidates remaining (every active candidate eliminated, every ballot exhausted). The latter is an edge case — see below.

---

## Sequential IRV (full tally)

```
elected = []
for runNum from 1 to 5:
  active = allTopics − elected
  result = runSingleIRV(ballots, active)
  if result.winner:
    elected.append(result.winner)
  else:
    elected.append(null)   // run failed, position vacant
return elected, run-by-run round details
```

After a run, the winner is removed from the active set for subsequent runs. Ballots are not modified — the active-candidate filter handles exclusion.

---

## Tie-break rules

Ties occur when two or more candidates have equal votes at a decision point. The system must be deterministic — same input, same output, every time.

### Rule

**Lower `order_num` wins ties.** Specifically:

- **For elimination ties**: when two or more candidates are tied for the lowest votes, eliminate the one with the **highest** `order_num` (i.e. preserve the lower-numbered topic — earlier in the syllabus).
- **For winner ties**: when two or more candidates are tied at >50% (rare), elect the one with the **lowest** `order_num`.

### Rationale

`order_num` is a property of the syllabus, not the voting. It's deterministic across runs, observable, and explainable to the class. Other tie-break options (random, alphabetical, by previous-round vote totals) either introduce randomness or compound complexity without obvious gain.

### Worked example

Three candidates A, B, C with `order_num` 5, 12, 20 respectively. Round produces A=4, B=4, C=2.

- C has the fewest, but B and A are not tied for fewest, so this is not a tie. C is eliminated.

Round produces A=5, B=5, C=2. C is eliminated; B and A advance.

Round produces A=4, B=4, C=4. All three tied for fewest. Eliminate the one with the highest `order_num` = C (order_num 20).

---

## Edge cases

### 1. Empty ballots

A ballot with zero rankings is exhausted in every round of every run. It contributes to `total ballots` but always appears in the exhausted count.

### 2. All ballots exhausted in a run

If after enough eliminations every remaining ballot has no active preference left, no candidate has any votes. The run cannot produce a winner.

**Decision:** the run fails, that position remains vacant (`null`), and the tally proceeds to the next run with the elected set unchanged.

In practice this is extremely rare with 32 voters and 32 candidates and partial-ranking allowance. It can happen in the 4th or 5th run if voters' rankings were very shallow.

### 3. Fewer than 5 distinct topics in any ballot

If the union of all topics across all ballots is fewer than 5, only that many positions can be elected. Remaining positions are vacant.

### 4. Single-candidate run

If only one candidate remains active and has at least one vote, they win immediately in round 1 of that run with whatever votes they receive.

### 5. Identical first-preference dominance

If every ballot ranks the same topic first, that topic wins run 1 in round 1 with 100% (of non-exhausted). Move to run 2 normally.

### 6. Topic appears on no ballot

A topic that no voter ranked never accumulates votes. It's eliminated as soon as a tied-for-fewest situation involves it, or implicitly when ranking by votes (it has 0).

### 7. Elimination order in a round

Eliminate exactly **one** candidate per round (the lowest, with tie-break). Don't batch-eliminate multiple candidates in a round, even if several are tied at zero. Rationale: keeps round-by-round display clean and gives the audit trail one elimination per row.

### 8. Re-running the tally

Running the tally is idempotent: same ballots and same topics produce the same result. The `run_tally()` function clears `tally_results` and rewrites within a transaction. If a beadle extends the deadline and runs again, results update accordingly.

### 9. Ballots submitted but with self-vote

A presenter ranking their own topic is permitted. The algorithm doesn't care about identity — it just sees rankings.

---

## Output format

### Per round

```ts
interface RoundResult {
  round: number;             // 1-indexed within the run
  candidates: Array<{
    topicId: number;
    votes: number;
    pct: number;             // share of non-exhausted ballots, 0–100, rounded to 1dp
  }>;                        // sorted by votes descending, then order_num ascending
  exhausted: number;         // ballots with no active preference this round
  totalActive: number;       // non-exhausted vote total
  eliminated: number | null; // topicId eliminated this round, or null if a winner was found
  winner: number | null;     // topicId elected this round, or null if elimination occurred
}
```

### Per run

```ts
interface RunResult {
  position: number;          // 1..5
  winner: number | null;     // topicId, or null if run failed
  rounds: RoundResult[];
  finalShare: number;        // winner's % of non-exhausted in the final round; 0 if failed
}
```

### Tally

```ts
interface TallyResult {
  runs: RunResult[];          // length 5; entries may have winner=null for vacant positions
  totalBallots: number;       // count of submitted ballots
  topicsCount: number;        // 32 in production
  computedAt: string;         // ISO timestamp
}
```

The `RoundResult` is what `tally_results.rounds` jsonb stores. Cleanly serialisable.

---

## TypeScript signature

```ts
// lib/irv.ts

export interface Ballot {
  voterId: string;
  rankings: Array<{ topicId: number; rank: number }>; // sorted by rank ascending
}

export interface Topic {
  id: number;
  orderNum: number;
}

export function tally(
  ballots: Ballot[],
  topics: Topic[],
  positions: number = 5
): TallyResult;
```

Pure function. No I/O. No randomness. No date dependencies inside the algorithm (pass `computedAt` as a parameter or set in the calling code).

---

## Test fixtures

These are the unit tests Phase 1 must pass. Add to `lib/irv.test.ts`. Each fixture specifies inputs (ballots + topics) and expected `TallyResult` invariants. Use Vitest or Jest.

For brevity, the topics are `[{id:1,orderNum:1}, {id:2,orderNum:2}, ...]` unless otherwise specified.

### Test 1 — Clear winner, single round

```
ballots:
  10 × [1]                 // all rank topic 1 first, nothing else
positions: 5
```

Expected:

- Run 1: winner=1, 1 round, finalShare=100.
- Run 2: winner=null (no preferences left), all subsequent runs same.

### Test 2 — Standard IRV elimination

Topics: 1, 2, 3.

```
ballots:
  4 × [1, 2, 3]
  3 × [2, 1, 3]
  3 × [3, 2, 1]
positions: 3
```

Expected:

- Run 1: 
  - Round 1: 1=4, 2=3, 3=3. No majority. Eliminate higher-orderNum of tied lowest → eliminate 3.
  - Round 2: 1=4, 2=6 (3+3 transferred). Winner = 2. finalShare = 60.
- Run 2 (active = {1, 3}):
  - Round 1: 1=7 (4+3), 3=3. Winner = 1. finalShare = 70.
- Run 3 (active = {3}):
  - Round 1: 3=10. Winner = 3. finalShare = 100.

### Test 3 — Tied lowest, tie-break works

Topics: 1, 2, 3.

```
ballots:
  3 × [1]
  3 × [2]
  3 × [3]
positions: 3
```

Expected:

- Run 1 round 1: all tied at 3, total 9, no majority. Eliminate highest orderNum = 3.
- Run 1 round 2: 1=3, 2=3. Three [3] ballots exhaust. totalActive=6. No majority. Eliminate higher orderNum = 2.
- Run 1 round 3: 1=3. Six ballots exhausted ([2] and [3] groups). Single candidate remaining with votes. Winner = 1.
- Run 2 (active = {2, 3}):
  - Round 1: 2=3, 3=3. Three [1] ballots exhaust. totalActive=6. Tied. Eliminate higher orderNum = 3.
  - Round 2: 2=3. Single candidate with votes. Winner = 2.
- Run 3 (active = {3}):
  - Round 1: 3=3. Six ballots exhausted ([1] and [2] groups). Winner = 3.

### Test 4 — Partial rankings with transfers

Topics: 1, 2, 3, 4. Ballots reference all four.

```
ballots:
  5 × [1, 2]              // partial rankings
  5 × [2, 1]
  3 × [3, 4]
  2 × [4]
positions: 4
```

Expected:

- Run 1 round 1: 1=5, 2=5, 3=3, 4=2. Total 15. No majority. Eliminate lowest = 4.
- Run 1 round 2: 1=5, 2=5, 3=3. Two ballots from 4 had no next preference → exhausted. Total non-exhausted = 13. No majority (>6.5 needed). Eliminate lowest = 3.
- Run 1 round 3: 1=5, 2=5. Three ballots from 3 had next pref = 4 (already eliminated, so they exhaust). Wait — re-check: 3 voters had `[3, 4]`, when 4 was eliminated then 3 was eliminated, those ballots exhaust. Total non-exhausted = 10. Tie. Eliminate higher orderNum = 2.
- Run 1 round 4: 1=10 (5 own + 5 transferred from 2). Winner = 1. finalShare = 100.

### Test 5 — Empty ballot

Topics: 1, 2.

```
ballots:
  3 × [1, 2]
  3 × [2, 1]
  4 × []                   // 4 empty ballots
positions: 2
```

Expected:

- Run 1 round 1: 1=3, 2=3. Total non-exhausted=6, exhausted=4. No majority. Eliminate higher orderNum = 2.
- Run 1 round 2: 1=6. Winner = 1. (Total non-exhausted = 6.)
- Run 2 (active = {2}): 1's preferences gone. Only 2 remains. 3 voters had 2 as their first pref, and 3 had 2 as second. With 1 elected, those ballots all have 2 as top active preference. 2 = 6. Winner = 2.

### Test 6 — Self-vote not special

Doesn't matter to the algorithm; included to confirm. A ballot identical to another except the voter is also the presenter of one of the ranked topics produces the same tally as if any other voter cast it.

### Test 7 — Idempotence

Calling `tally()` twice with the same inputs returns deeply-equal `TallyResult` (modulo `computedAt`).

### Test 8 — Ordering invariance

Calling `tally()` with the input `ballots` array in different orders returns the same result. Same for `topics`. Since the algorithm is deterministic given inputs, ballot input order must not affect output.

### Test 9 — Larger realistic scenario

32 topics, 30 ballots, partial rankings of varying length. Snapshot the result. Use this as a regression test — any algorithm change should produce the same snapshot or be a deliberate, reviewed update.

(Generate via a fixed seeded RNG; commit the seed and the expected output JSON.)

### Test 10 — All ballots exhausted in run 4

Topics: 1, 2, 3, 4, 5. Ballots all rank only 1, 2, 3.

```
ballots:
  10 × [1, 2, 3]
  10 × [2, 3, 1]
  10 × [3, 1, 2]
positions: 5
```

Expected:

- Runs 1, 2, 3: produce winners (some permutation of 1, 2, 3, depending on transfers).
- Run 4 (active = {4, 5}): no ballots have 4 or 5 ranked. All exhausted. Winner = null.
- Run 5: same. Winner = null.

---

## Implementation notes

- Use plain JavaScript objects and arrays. No external libraries needed.
- Round all percentages once, at the output stage. Internal computations use integer vote counts.
- Sort candidates within `RoundResult.candidates` by votes desc, then by orderNum asc, for stable display.
- Keep the algorithm pure — no logging, no DB calls, no time. The Postgres function `run_tally()` calls into this via a Postgres-side wrapper or, if running in TypeScript, as a server action that reads ballots through service_role.
- Wrap the algorithm in a transaction at the calling site so the cached `tally_results` is consistent.
- Never expose individual ballots or rankings in the output. The `TallyResult` type contains only aggregates.
