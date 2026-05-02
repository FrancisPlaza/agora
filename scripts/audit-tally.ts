/**
 * Agora — IRV audit re-tally CLI.
 *
 * Run with:  npm run audit:tally -- path/to/ballots.csv
 *      (or: npx tsx scripts/audit-tally.ts path/to/ballots.csv)
 *
 * Reads an anonymised CSV of cast ballots and runs the production
 * `lib/irv.ts` tally against them. The script imports the actual
 * tally function — there is no reimplementation. If `lib/irv.ts`
 * changes, this script's output changes with it; the tests in
 * audit-tally.test.ts are the regression bar.
 *
 * Self-contained: no env vars, no DB connection, no network. The
 * 32 topic names are embedded below for output decoration.
 *
 * Flags:
 *   --json     Emit raw TallyResult JSON instead of formatted text.
 *   --silent   Drop philosopher/theme decoration (topic IDs only).
 *
 * Expected CSV schema (header required):
 *   ballot_id,topic_id,rank
 *   <uuid>,<1..32>,<positive int>
 *   ...
 *
 * See README.md "Verifying and auditing the IRV tally" for the
 * user-facing contract this script implements.
 */

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import {
  tally,
  type Ballot,
  type TallyResult,
  type Topic,
} from "../lib/irv";

// ── Topics ─────────────────────────────────────────────────────────────
// Embedded copy of supabase/migrations/0006_seed_topics.sql. If that
// migration ever changes, this list must change to match or the audit
// output will misname topics. The id and orderNum feed tally();
// philosopher and theme are output decoration only.

interface TopicMeta {
  id: number;
  orderNum: number;
  philosopher: string;
  theme: string;
}

const TOPICS: TopicMeta[] = [
  { id: 1, orderNum: 1, philosopher: "David Hume", theme: "Legal Positivism" },
  { id: 2, orderNum: 2, philosopher: "Jeremy Bentham", theme: "On the Principles of Morals and Legislation" },
  { id: 3, orderNum: 3, philosopher: "John Austin", theme: "The Province of Jurisprudence" },
  { id: 4, orderNum: 4, philosopher: "Hans Kelsen", theme: "Pure Theory of Law" },
  { id: 5, orderNum: 5, philosopher: "Thomas Hobbes", theme: "Legalism, or Rule by the Law" },
  { id: 6, orderNum: 6, philosopher: "Herbert Hart", theme: "Rule of Recognition" },
  { id: 7, orderNum: 7, philosopher: "Confucianism", theme: "Political Theory and Rectification of Names" },
  { id: 8, orderNum: 8, philosopher: "Ronald Dworkin", theme: "Interpretivist Approach and Best Fit Theory" },
  { id: 9, orderNum: 9, philosopher: "Justice Oliver Wendell Holmes", theme: "The Path of the Law" },
  { id: 10, orderNum: 10, philosopher: "Roberto Mangabeira Unger", theme: "Hegemony, Deconstruction and Hermeneutics of Suspicion" },
  { id: 11, orderNum: 11, philosopher: "Friedrich Karl von Savigny", theme: "The Volksgeist" },
  { id: 12, orderNum: 12, philosopher: "Sir Henry Sumner Maine", theme: "Legal History Theory" },
  { id: 13, orderNum: 13, philosopher: "G.W.F. Hegel", theme: "Dialectic Idealism and the Philosophy of Law" },
  { id: 14, orderNum: 14, philosopher: "William James", theme: "Law as a Means to Satisfy Needs" },
  { id: 15, orderNum: 15, philosopher: "Emile Durkheim", theme: "Theory of Legal Change" },
  { id: 16, orderNum: 16, philosopher: "Charles Louis Baron de Montesquieu", theme: "Adapting Law to Shifting Conditions" },
  { id: 17, orderNum: 17, philosopher: "R. Von Jhering", theme: "Law as a Method of Ordering Society" },
  { id: 18, orderNum: 18, philosopher: "Roscoe Pound", theme: "The Scope and Purpose of Sociological Jurisprudence" },
  { id: 19, orderNum: 19, philosopher: "Max Weber", theme: "Typology of Law" },
  { id: 20, orderNum: 20, philosopher: "Roberto Mangabeira Unger", theme: "Cultural Context Theory" },
  { id: 21, orderNum: 21, philosopher: "Eugen Ehrlich", theme: "The Living Law" },
  { id: 22, orderNum: 22, philosopher: "Talcott Parsons", theme: "Law as Integrativist Mechanism of Social Control" },
  { id: 23, orderNum: 23, philosopher: "John Rawls", theme: "The Sociological School" },
  { id: 24, orderNum: 24, philosopher: "Jeremy Bentham", theme: "Felicific Calculus" },
  { id: 25, orderNum: 25, philosopher: "John Stuart Mill", theme: "Utilitarianism, Law and Authority" },
  { id: 26, orderNum: 26, philosopher: "Henry Sidgwick", theme: "Act and Rule Utilitarianism" },
  { id: 27, orderNum: 27, philosopher: "Richard Posner", theme: "Economic Jurisprudence and Consequentialism" },
  { id: 28, orderNum: 28, philosopher: "Jeremy Bentham", theme: "Originalism, Textualism, the Plain Meaning Approach" },
  { id: 29, orderNum: 29, philosopher: "Antonin Scalia", theme: "Contemporary Originalism" },
  { id: 30, orderNum: 30, philosopher: "Harold Lasswell and Myres McDougal", theme: "Legal Education and Public Policy" },
  { id: 31, orderNum: 31, philosopher: "Philip Bobbitt", theme: "The Six Main Modalities" },
  { id: 32, orderNum: 32, philosopher: "Bonum Commune", theme: "The Aristotelian-Thomistic Tradition" },
];

// ── CSV parsing + validation ───────────────────────────────────────────

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const HEADER = "ballot_id,topic_id,rank";

export class CsvValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "CsvValidationError";
  }
}

interface ParsedCsv {
  ballots: Ballot[];
}

/**
 * Parse the ballot CSV and validate per the schema rules. Throws
 * `CsvValidationError` with a row-numbered message on any failure.
 * Returns a ready-to-tally `Ballot[]`.
 */
export function parseAndValidate(csv: string): ParsedCsv {
  const lines = csv.replace(/\r\n/g, "\n").split("\n");
  while (lines.length > 0 && lines[lines.length - 1].trim() === "") {
    lines.pop();
  }
  if (lines.length === 0) {
    throw new CsvValidationError("CSV is empty.");
  }

  const header = lines[0].trim();
  if (header !== HEADER) {
    throw new CsvValidationError(
      `Row 1: expected header "${HEADER}", got "${header}".`,
    );
  }

  if (lines.length === 1) {
    throw new CsvValidationError("CSV has a header but no data rows.");
  }

  interface RawRow {
    ballot: string;
    topic: number;
    rank: number;
    rowNum: number;
  }
  const rows: RawRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const rowNum = i + 1; // 1-indexed line number including the header
    const line = lines[i].trim();
    if (line === "") continue; // tolerate stray blank lines mid-file

    const parts = line.split(",");
    if (parts.length !== 3) {
      throw new CsvValidationError(
        `Row ${rowNum}: expected 3 fields (ballot_id,topic_id,rank), got ${parts.length}.`,
      );
    }
    const [ballot, topicStr, rankStr] = parts.map((s) => s.trim());

    if (!UUID_RE.test(ballot)) {
      throw new CsvValidationError(
        `Row ${rowNum}: ballot_id "${ballot}" is not a UUID.`,
      );
    }

    const topic = Number(topicStr);
    if (!Number.isInteger(topic) || topic < 1 || topic > 32) {
      throw new CsvValidationError(
        `Row ${rowNum}: topic_id "${topicStr}" is not an integer in 1..32.`,
      );
    }

    const rank = Number(rankStr);
    if (!Number.isInteger(rank) || rank < 1) {
      throw new CsvValidationError(
        `Row ${rowNum}: rank "${rankStr}" is not a positive integer.`,
      );
    }

    rows.push({ ballot, topic, rank, rowNum });
  }

  if (rows.length === 0) {
    throw new CsvValidationError("CSV has a header but no data rows.");
  }

  // Detect duplicate (ballot_id, topic_id) and (ballot_id, rank) pairs.
  const seenBallotTopic = new Map<string, number>();
  const seenBallotRank = new Map<string, number>();
  for (const row of rows) {
    const bt = `${row.ballot}|${row.topic}`;
    const prevBt = seenBallotTopic.get(bt);
    if (prevBt !== undefined) {
      throw new CsvValidationError(
        `Row ${row.rowNum}: duplicate (ballot_id, topic_id) pair — also seen at row ${prevBt}.`,
      );
    }
    seenBallotTopic.set(bt, row.rowNum);

    const br = `${row.ballot}|${row.rank}`;
    const prevBr = seenBallotRank.get(br);
    if (prevBr !== undefined) {
      throw new CsvValidationError(
        `Row ${row.rowNum}: duplicate (ballot_id, rank) pair — also seen at row ${prevBr}.`,
      );
    }
    seenBallotRank.set(br, row.rowNum);
  }

  // Group by ballot, sort by rank, validate dense rank sequence.
  const byBallot = new Map<
    string,
    Array<{ topic: number; rank: number; rowNum: number }>
  >();
  for (const row of rows) {
    const arr = byBallot.get(row.ballot) ?? [];
    arr.push({ topic: row.topic, rank: row.rank, rowNum: row.rowNum });
    byBallot.set(row.ballot, arr);
  }

  const ballots: Ballot[] = [];
  for (const [ballotId, entries] of byBallot) {
    entries.sort((a, b) => a.rank - b.rank);
    for (let i = 0; i < entries.length; i++) {
      const expected = i + 1;
      if (entries[i].rank !== expected) {
        throw new CsvValidationError(
          `Row ${entries[i].rowNum}: rank ${entries[i].rank} for ballot ${ballotId} breaks dense sequence (expected ${expected}).`,
        );
      }
    }
    ballots.push({
      voterId: ballotId,
      rankings: entries.map((e) => ({ topicId: e.topic, rank: e.rank })),
    });
  }

  return { ballots };
}

// ── Output rendering ───────────────────────────────────────────────────

const SEP = "─".repeat(58);

interface FormatOptions {
  silent: boolean;
}

function lastWord(s: string): string {
  const tokens = s.split(/\s+/).filter(Boolean);
  return tokens.length === 0 ? s : tokens[tokens.length - 1];
}

export function formatResult(
  result: TallyResult,
  filename: string,
  options: FormatOptions,
): string {
  const out: string[] = [];
  const topicById = new Map<number, TopicMeta>(TOPICS.map((t) => [t.id, t]));

  function decorate(id: number): string {
    const t = topicById.get(id);
    if (!t || options.silent) return `Topic ${id}`;
    return `Topic ${id} · ${t.philosopher} · ${t.theme}`;
  }
  function abbrev(id: number): string {
    const t = topicById.get(id);
    if (!t || options.silent) return `Topic ${id}`;
    return `Topic ${id} (${lastWord(t.philosopher)})`;
  }

  out.push(`Agora IRV audit — re-tally from ${filename}`);
  out.push("");
  out.push(`Total ballots: ${result.totalBallots}`);
  if (result.computedAt) out.push(`Computed at: ${result.computedAt}`);
  out.push("");

  for (const run of result.runs) {
    out.push(SEP);
    if (run.winner !== null) {
      out.push(`Run ${run.position} — winner: ${decorate(run.winner)}`);
    } else {
      out.push(`Run ${run.position} — no winner (all eliminated or exhausted)`);
    }
    out.push(SEP);
    out.push("");

    for (const round of run.rounds) {
      out.push(`  Round ${run.position}.${round.round}`);
      for (const c of round.candidates) {
        const votes = String(c.votes).padStart(3);
        const pct = c.pct.toFixed(1).padStart(5);
        out.push(`    ${abbrev(c.topicId).padEnd(40)} ${votes}   ${pct}%`);
      }
      if (round.exhausted > 0) {
        out.push(`    Exhausted: ${round.exhausted}`);
      }
      if (round.eliminated !== null) {
        out.push(
          `    Eliminated: ${abbrev(round.eliminated)} — fewest first-prefs`,
        );
      }
      if (round.winner !== null) {
        out.push(`    >> ${abbrev(round.winner)} reaches majority`);
      }
      out.push("");
    }
  }

  out.push(SEP);
  out.push("Top 5 (in order of selection):");
  for (const run of result.runs) {
    if (run.winner !== null) {
      out.push(`  ${run.position}. ${decorate(run.winner)}`);
    } else {
      out.push(`  ${run.position}. (vacant)`);
    }
  }
  out.push(SEP);
  out.push("");
  out.push("Audit complete. Compare against the published Results page.");

  return out.join("\n");
}

// ── Main ───────────────────────────────────────────────────────────────

function main() {
  const args = process.argv.slice(2);
  const path = args.find((a) => !a.startsWith("--"));
  const options: FormatOptions = { silent: args.includes("--silent") };
  const json = args.includes("--json");

  if (!path) {
    console.error("Usage: npm run audit:tally -- <path-to-ballots.csv>");
    process.exit(1);
  }

  let csv: string;
  try {
    csv = readFileSync(path, "utf-8");
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Could not read ${path}: ${message}`);
    process.exit(1);
  }

  let parsed: ParsedCsv;
  try {
    parsed = parseAndValidate(csv);
  } catch (err) {
    if (err instanceof CsvValidationError) {
      console.error(`CSV validation failed: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  const topicsForTally: Topic[] = TOPICS.map((t) => ({
    id: t.id,
    orderNum: t.orderNum,
  }));
  const result = tally(
    parsed.ballots,
    topicsForTally,
    5,
    new Date().toISOString(),
  );

  if (json) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    console.log(formatResult(result, path, options));
  }
}

// Only run main() when this file is the entry point (i.e. invoked via
// `tsx scripts/audit-tally.ts ...`). Imports from the test file skip
// it because process.argv[1] points at vitest's runner, not this file.
if (process.argv[1] && process.argv[1] === fileURLToPath(import.meta.url)) {
  main();
}
