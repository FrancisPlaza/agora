/**
 * Sandbox seed script.
 *
 * Run with:  npx tsx scripts/seed-sandbox.ts
 *
 * Required env (sourced before invocation):
 *   SUPABASE_URL              — sandbox Supabase project URL
 *   SUPABASE_SERVICE_ROLE_KEY — sandbox service-role key
 *
 * SAFETY GUARD: aborts unless SUPABASE_URL contains `127.0.0.1` (local)
 * OR the explicit `AGORA_SEED_OK=true` env var is set. A misfired seed
 * against production would corrupt real data. If your sandbox URL
 * doesn't match either condition, set AGORA_SEED_OK=true and run again
 * — but only after triple-checking the URL.
 *
 * The script uses service-role to bypass RLS and write directly to
 * the public tables. It does NOT call the Phase 6 admin RPCs because
 * those check is_admin() / auth.uid(), which are null in a service-
 * role context. The runtime path through the admin UI is verified by
 * manual smoke after the seed populates state.
 *
 * Idempotency: detects existing seed users by email prefix and skips
 * the create step. Topics, ballots, and tally are wiped + rewritten
 * on every run so re-running gives a clean reproducible state.
 */
import { deflateSync } from "node:zlib";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { tally, type Ballot, type Topic } from "../lib/irv";

const SEED_PREFIX = "seed-";
const VOTERS_COUNT = 10;
const PRESENTED_TOPICS = 6;
const SUBMITTED_BALLOTS = 5;

interface SeededUser {
  id: string;
  email: string;
  full_name: string;
  topicId: number | null;
  isAdmin: boolean;
}

function abortIfNotSandbox(url: string) {
  const isLocal = url.includes("127.0.0.1") || url.includes("localhost");
  const explicit = process.env.AGORA_SEED_OK === "true";
  if (!isLocal && !explicit) {
    console.error(
      `Refusing to seed against ${url}. ` +
        `Set AGORA_SEED_OK=true to override (only after confirming this is a sandbox project).`,
    );
    process.exit(2);
  }
}

async function main() {
  const url = process.env.SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? "";
  if (!url || !key) {
    console.error(
      "SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be set in env.",
    );
    process.exit(1);
  }
  abortIfNotSandbox(url);

  console.log(`Seeding sandbox at ${url} ...`);
  const sb = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  // ── 0. Wipe prior seeded ballots / tally so re-runs are clean. ───
  await sb.from("rankings").delete().gte("rank", 1);
  await sb.from("ballots").delete().not("id", "is", null);
  await sb.from("tally_results").delete().gte("run_num", 1);
  await sb
    .from("voting_state")
    .update({
      polls_open_at: null,
      deadline_at: null,
      polls_locked: false,
      polls_locked_at: null,
      polls_locked_by: null,
      tally_run_at: null,
    })
    .eq("id", 1);

  // ── 1. Create voter accounts (idempotent — skip if email exists). ─
  const seeded: SeededUser[] = [];
  for (let i = 1; i <= VOTERS_COUNT; i++) {
    const email = `${SEED_PREFIX}voter${i}@sanbeda.edu.ph`;
    const fullName = `Seed Voter ${i}`;
    const studentId = `2024-${String(8000 + i).padStart(4, "0")}`;
    const id = await ensureUser(sb, email, fullName, studentId);
    seeded.push({
      id,
      email,
      full_name: fullName,
      topicId: i, // Topic 1..VOTERS_COUNT
      isAdmin: i === 1, // first seeded voter doubles as the test beadle
    });
  }

  // ── 2. Approve each + assign topic; promote first to admin. ──────
  for (const v of seeded) {
    await sb
      .from("profiles")
      .update({
        status: "approved",
        approved_at: new Date().toISOString(),
        is_admin: v.isAdmin,
      })
      .eq("id", v.id);
  }

  // Clear any prior assignments before re-assigning so the unique
  // constraint on topics.presenter_voter_id doesn't reject us.
  for (let i = 1; i <= 32; i++) {
    await sb
      .from("topics")
      .update({
        presenter_voter_id: null,
        scheduled_for: null,
        presented_at: null,
        art_title: null,
        art_explanation: null,
        art_image_path: null,
        art_uploaded_at: null,
      })
      .eq("id", i);
  }
  for (const v of seeded) {
    if (v.topicId == null) continue;
    await sb
      .from("topics")
      .update({ presenter_voter_id: v.id })
      .eq("id", v.topicId);
  }

  // ── 3. Mark some topics presented; upload synthetic artwork. ─────
  for (let i = 1; i <= PRESENTED_TOPICS; i++) {
    const presentedAt = new Date(
      Date.now() - (PRESENTED_TOPICS - i + 1) * 86400000,
    ).toISOString();
    await sb
      .from("topics")
      .update({ presented_at: presentedAt })
      .eq("id", i);

    // 4 of those 6 also get artwork (state = published).
    if (i <= 4) {
      const objectPath = `${i}/artwork.png`;
      const png = synthPng();
      await sb.storage.from("presentations").remove([objectPath]).catch(() => {});
      await sb.storage
        .from("presentations")
        .upload(objectPath, png, { contentType: "image/png", upsert: true });
      await sb
        .from("topics")
        .update({
          art_title: `Seed artwork ${i}`,
          art_explanation: `A synthetic placeholder for topic ${i}. The real explanation lands when the assigned presenter uploads their work.`,
          art_image_path: objectPath,
          art_uploaded_at: new Date().toISOString(),
        })
        .eq("id", i);
    }
  }

  // ── 4. Synthetic submitted ballots for half the voters. ──────────
  for (let i = 0; i < SUBMITTED_BALLOTS; i++) {
    const voter = seeded[i];
    const { data: ballot } = await sb
      .from("ballots")
      .insert({ voter_id: voter.id, submitted_at: new Date().toISOString() })
      .select("id")
      .single();
    if (!ballot) continue;
    // Each voter ranks 5–8 random topics in stable-but-varied order.
    const ranking = pickRanking(i, 5 + (i % 4));
    for (let r = 0; r < ranking.length; r++) {
      await sb.from("rankings").insert({
        ballot_id: ballot.id,
        topic_id: ranking[r],
        rank: r + 1,
      });
    }
  }

  // ── 5. Open polls, set deadline, lock. ──────────────────────────
  const now = new Date();
  const deadline = new Date(now.getTime() + 7 * 86400000);
  await sb
    .from("voting_state")
    .update({
      polls_open_at: new Date(now.getTime() - 86400000).toISOString(),
      deadline_at: deadline.toISOString(),
      polls_locked: true,
      polls_locked_at: now.toISOString(),
      polls_locked_by: seeded[0].id,
    })
    .eq("id", 1);

  // ── 6. Run IRV (real algorithm) and write tally_results. ────────
  const { data: ballotsData } = await sb
    .from("ballots")
    .select("id, voter_id")
    .not("submitted_at", "is", null);
  const { data: rankingsData } = await sb
    .from("rankings")
    .select("ballot_id, topic_id, rank");
  const { data: topicsData } = await sb
    .from("topics")
    .select("id, order_num");

  const rankingsByBallot = new Map<string, Array<{ topicId: number; rank: number }>>();
  for (const r of rankingsData ?? []) {
    const arr = rankingsByBallot.get(r.ballot_id) ?? [];
    arr.push({ topicId: r.topic_id, rank: r.rank });
    rankingsByBallot.set(r.ballot_id, arr);
  }
  const ballots: Ballot[] = (ballotsData ?? []).map((b) => ({
    voterId: b.voter_id,
    rankings: (rankingsByBallot.get(b.id) ?? []).sort((a, b) => a.rank - b.rank),
  }));
  const topics: Topic[] = (topicsData ?? []).map((t) => ({
    id: t.id,
    orderNum: t.order_num,
  }));

  const result = tally(ballots, topics, 5, new Date().toISOString());

  await sb.from("tally_results").delete().gte("run_num", 1);
  for (const run of result.runs) {
    const lastRound = run.rounds[run.rounds.length - 1];
    await sb.from("tally_results").insert({
      run_num: run.position,
      winner_topic_id: run.winner,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      rounds: run.rounds as any,
      total_ballots: result.totalBallots,
      exhausted: lastRound?.exhausted ?? 0,
    });
  }
  await sb
    .from("voting_state")
    .update({ tally_run_at: new Date().toISOString() })
    .eq("id", 1);

  // ── Summary ─────────────────────────────────────────────────────
  console.log("\nSeed complete.\n");
  console.log("Test accounts:");
  for (const v of seeded) {
    console.log(
      `  ${v.email}  ·  ${v.full_name}  ·  topic ${v.topicId}${v.isAdmin ? "  ·  ADMIN" : ""}`,
    );
  }
  console.log(`\nWinners (by run):`);
  for (const run of result.runs) {
    const winnerLabel = run.winner != null ? `Topic ${run.winner}` : "vacant";
    console.log(
      `  Run ${run.position}: ${winnerLabel}  (${run.rounds.length} rounds, finalShare ${run.finalShare}%)`,
    );
  }
  console.log(
    `\nTotal ballots: ${result.totalBallots} · ${result.runs.reduce((a, r) => a + r.rounds.length, 0)} rounds total`,
  );
}

async function ensureUser(
  sb: SupabaseClient,
  email: string,
  fullName: string,
  studentId: string,
): Promise<string> {
  // Check if the user already exists (re-run idempotency).
  // listUsers paginates; we'll just scan the first 100.
  const { data: list } = await sb.auth.admin.listUsers({ perPage: 200 });
  const existing = list?.users.find((u) => u.email === email);
  if (existing) return existing.id;

  const { data, error } = await sb.auth.admin.createUser({
    email,
    email_confirm: true,
    user_metadata: { full_name: fullName, student_id: studentId },
  });
  if (error || !data.user) {
    throw new Error(`createUser failed for ${email}: ${error?.message}`);
  }
  return data.user.id;
}

/**
 * Generates a tiny solid-colour PNG (8x8) so reviewers see *something*
 * non-empty when they hit a published topic card. Real artwork lands
 * via the presenter upload flow.
 */
function synthPng(): Uint8Array {
  // Pre-encoded 8x8 solid-colour PNGs would normally come from a tool;
  // we hand-roll a minimal one (signature + IHDR + IDAT + IEND).
  // Keep it tiny — local loopback storage doesn't need the bandwidth
  // of a full thumbnail.
  const sig = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = chunk(
    "IHDR",
    Uint8Array.from([
      0,
      0,
      0,
      8, // width 8
      0,
      0,
      0,
      8, // height 8
      8, // bit depth
      2, // color type RGB
      0,
      0,
      0,
    ]),
  );
  // 8 rows of 1 filter byte + 8 RGB pixels.
  const raw = new Uint8Array(8 * (1 + 8 * 3));
  for (let y = 0; y < 8; y++) {
    raw[y * 25] = 0;
    for (let x = 0; x < 8; x++) {
      const i = y * 25 + 1 + x * 3;
      raw[i] = 99 + ((x * 7) % 60); // R
      raw[i + 1] = 91 + ((y * 5) % 50); // G
      raw[i + 2] = 255 - ((x + y) * 5); // B
    }
  }
  const compressed = deflateSync(raw);
  const idat = chunk("IDAT", compressed);
  const iend = chunk("IEND", new Uint8Array(0));
  return concat([sig, ihdr, idat, iend]);
}

function chunk(type: string, data: Uint8Array): Uint8Array {
  const len = new Uint8Array(4);
  new DataView(len.buffer).setUint32(0, data.length, false);
  const typeBytes = new TextEncoder().encode(type);
  const crcInput = concat([typeBytes, data]);
  const crc = crc32(crcInput);
  const crcBytes = new Uint8Array(4);
  new DataView(crcBytes.buffer).setUint32(0, crc, false);
  return concat([len, typeBytes, data, crcBytes]);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((a, p) => a + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out;
}

function crc32(buf: Uint8Array): number {
  let c = 0xffffffff;
  for (const b of buf) {
    c ^= b;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
  }
  return (c ^ 0xffffffff) >>> 0;
}

function pickRanking(seed: number, length: number): number[] {
  // Deterministic shuffle of topics 1..32, take `length`.
  const arr = Array.from({ length: 32 }, (_, i) => i + 1);
  let s = seed * 9301 + 49297;
  for (let i = arr.length - 1; i > 0; i--) {
    s = (s * 9301 + 49297) % 233280;
    const j = Math.abs(s) % (i + 1);
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr.slice(0, length);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
