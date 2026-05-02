import { describe, expect, it } from "vitest";
import { tally, type Ballot, type Topic } from "../lib/irv";
import { CsvValidationError, parseAndValidate } from "./audit-tally";

function makeTopics(n: number): Topic[] {
  return Array.from({ length: n }, (_, i) => ({ id: i + 1, orderNum: i + 1 }));
}

const TOPICS_32: Topic[] = makeTopics(32);

const UUID_A = "11111111-1111-1111-1111-111111111111";
const UUID_B = "22222222-2222-2222-2222-222222222222";
const UUID_C = "33333333-3333-3333-3333-333333333333";

function csv(...rows: string[]): string {
  return ["ballot_id,topic_id,rank", ...rows].join("\n");
}

// ── Happy-path: CSV parser produces the same ballots as direct construction ──

describe("audit-tally — CSV-to-Ballot adapter agrees with direct construction", () => {
  it("clear winner, single round (mirrors irv.test.ts Test 1 shape)", () => {
    // 3 voters, all rank topic 1 first. 3-topic universe matches the
    // original irv.test.ts fixture so the IRV trajectory is identical.
    const topics = makeTopics(3);
    const fixture = csv(
      `${UUID_A},1,1`,
      `${UUID_B},1,1`,
      `${UUID_C},1,1`,
    );
    const { ballots } = parseAndValidate(fixture);
    expect(ballots).toHaveLength(3);

    const direct: Ballot[] = [
      { voterId: UUID_A, rankings: [{ topicId: 1, rank: 1 }] },
      { voterId: UUID_B, rankings: [{ topicId: 1, rank: 1 }] },
      { voterId: UUID_C, rankings: [{ topicId: 1, rank: 1 }] },
    ];

    const fromCsv = tally(ballots, topics, 5);
    const fromDirect = tally(direct, topics, 5);
    expect(fromCsv.runs).toEqual(fromDirect.runs);
    expect(fromCsv.runs[0].winner).toBe(1);
    expect(fromCsv.runs[0].finalShare).toBe(100);
  });

  it("standard IRV with elimination + transfer (mirrors irv.test.ts Test 2)", () => {
    // 4×[1,2,3], 3×[2,1,3], 3×[3,2,1] — round 1 ties at lowest, eliminate
    // topic 3 by tie-break (higher orderNum), then topic 2 wins via transfer.
    const topics = makeTopics(3);
    const aRows = Array.from({ length: 4 }, (_, i) => {
      const id = `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa${i}`;
      return [`${id},1,1`, `${id},2,2`, `${id},3,3`].join("\n");
    });
    const bRows = Array.from({ length: 3 }, (_, i) => {
      const id = `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb${i}`;
      return [`${id},2,1`, `${id},1,2`, `${id},3,3`].join("\n");
    });
    const cRows = Array.from({ length: 3 }, (_, i) => {
      const id = `cccccccc-cccc-cccc-cccc-cccccccccc${i}c`;
      return [`${id},3,1`, `${id},2,2`, `${id},1,3`].join("\n");
    });
    const fixture = csv(...aRows, ...bRows, ...cRows);

    const { ballots } = parseAndValidate(fixture);
    const result = tally(ballots, topics, 5);

    expect(result.runs[0].winner).toBe(2);
    expect(result.runs[0].rounds).toHaveLength(2);
    expect(result.runs[0].rounds[0].eliminated).toBe(3);
    expect(result.runs[0].finalShare).toBe(60);
    expect(result.runs[1].winner).toBe(1);
  });

  it("tie-break by orderNum (mirrors irv.test.ts Test 3 shape)", () => {
    // Three-way tie at first preferences. Algorithm eliminates the
    // highest orderNum first → topic 3 is eliminated before topic 2.
    const topics = makeTopics(3);
    const rows: string[] = [];
    for (let i = 0; i < 3; i++) {
      const a = `aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa${i}`;
      const b = `bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbb${i}`;
      const c = `cccccccc-cccc-cccc-cccc-cccccccccc${i}c`;
      rows.push(`${a},1,1`);
      rows.push(`${b},2,1`);
      rows.push(`${c},3,1`);
    }
    const { ballots } = parseAndValidate(csv(...rows));
    const result = tally(ballots, topics, 3);

    // First eliminated should be topic 3 (highest orderNum among tied lowest).
    expect(result.runs[0].rounds[0].eliminated).toBe(3);
  });

  it("the audit script's full topic universe (32) tallies without crashing", () => {
    // Smoke test against the real production-sized topics list. With
    // ballots only ranking topics 1-3, IRV eliminates topics 4..32
    // first (highest orderNum first) before getting to the meaningful
    // contest. Confirms the adapter handles the production shape.
    const fixture = csv(
      `${UUID_A},1,1`,
      `${UUID_B},2,1`,
      `${UUID_C},3,1`,
    );
    const { ballots } = parseAndValidate(fixture);
    const result = tally(ballots, TOPICS_32, 5);
    expect(result.totalBallots).toBe(3);
    expect(result.topicsCount).toBe(32);
    // First several rounds eliminate empty topics 32, 31, ... in order.
    expect(result.runs[0].rounds[0].eliminated).toBe(32);
  });
});

// ── Validation: malformed inputs surface row-numbered errors ──

describe("audit-tally — validation rejects malformed CSVs", () => {
  it("rejects a CSV with no header row", () => {
    expect(() => parseAndValidate(`${UUID_A},1,1`)).toThrow(
      CsvValidationError,
    );
    expect(() => parseAndValidate(`${UUID_A},1,1`)).toThrow(/header/);
  });

  it("rejects a CSV with header but no data rows", () => {
    expect(() => parseAndValidate("ballot_id,topic_id,rank\n")).toThrow(
      /no data rows/,
    );
  });

  it("rejects a duplicate (ballot_id, topic_id) pair, naming the row", () => {
    const fixture = csv(`${UUID_A},1,1`, `${UUID_A},1,2`);
    expect(() => parseAndValidate(fixture)).toThrow(
      /duplicate \(ballot_id, topic_id\) pair.*row 2/,
    );
  });

  it("rejects a duplicate (ballot_id, rank) pair", () => {
    const fixture = csv(`${UUID_A},1,1`, `${UUID_A},2,1`);
    expect(() => parseAndValidate(fixture)).toThrow(
      /duplicate \(ballot_id, rank\) pair/,
    );
  });

  it("rejects topic_id outside 1..32", () => {
    const fixture = csv(`${UUID_A},33,1`);
    expect(() => parseAndValidate(fixture)).toThrow(/1\.\.32/);
  });

  it("rejects topic_id = 0", () => {
    const fixture = csv(`${UUID_A},0,1`);
    expect(() => parseAndValidate(fixture)).toThrow(/1\.\.32/);
  });

  it("rejects a non-UUID ballot_id", () => {
    const fixture = csv(`not-a-uuid,1,1`);
    expect(() => parseAndValidate(fixture)).toThrow(/not a UUID/);
  });

  it("rejects a non-positive rank", () => {
    const fixture = csv(`${UUID_A},1,0`);
    expect(() => parseAndValidate(fixture)).toThrow(/positive integer/);
  });

  it("rejects a rank gap within a ballot (1, 2, 5)", () => {
    const fixture = csv(
      `${UUID_A},1,1`,
      `${UUID_A},2,2`,
      `${UUID_A},3,5`,
    );
    expect(() => parseAndValidate(fixture)).toThrow(/dense sequence/);
  });

  it("normalises CRLF line endings", () => {
    const fixture = ["ballot_id,topic_id,rank", `${UUID_A},1,1`].join("\r\n");
    const { ballots } = parseAndValidate(fixture);
    expect(ballots).toHaveLength(1);
  });
});
