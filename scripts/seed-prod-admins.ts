/**
 * Production admin seed.
 *
 * Run with:  npm run seed:prod-admins
 *           (or: npx tsx scripts/seed-prod-admins.ts)
 *
 * Required env (sourced before invocation):
 *   NEXT_PUBLIC_SUPABASE_URL — prod Supabase project URL
 *   SUPABASE_SECRET_KEY      — prod secret key (formerly the service-role key)
 *
 * Seeds three admins (Francis, Jay, Marlon) into a freshly-deployed prod
 * project. Without this script, the deploy checklist required a manual
 * SQL bootstrap because there's no UI for promoting the first beadle.
 *
 * Idempotent: re-running detects existing auth users by email and only
 * upserts the profile row. Existing `approved_at` timestamps are
 * preserved so the audit trail of the first successful seed wins.
 *
 * Topic assignment is intentionally out of scope. Francis and Jay get
 * topics assigned later via the admin UI; Marlon stays without a topic
 * (non-voting admin). The script seeds `is_admin = true, status =
 * 'approved'` for all three; the voter/non-voter distinction is purely
 * a function of `topics.presenter_voter_id`, not of profile flags.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import readline from "node:readline/promises";
import type { Database } from "../lib/supabase/database.types";

const ADMINS = [
  {
    email: "francis@plaza.ph",
    full_name: "Francis Plaza",
    student_id: "2025400356",
  },
  {
    email: "jayzielk.budino@gmail.com",
    full_name: "Jay Budino",
    student_id: "2025400225",
  },
  {
    email: "attytronquedsbcalaw@gmail.com",
    full_name: "Marlon Tronqued",
    student_id: "FACULTY-MTRONQUED",
  },
] as const;

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SECRET_KEY ?? "";
  if (!url) {
    console.error("NEXT_PUBLIC_SUPABASE_URL must be set in env.");
    process.exit(1);
  }
  if (!key) {
    console.error("SUPABASE_SECRET_KEY must be set in env.");
    process.exit(1);
  }

  console.log(`\nAbout to seed ${ADMINS.length} admin accounts into:`);
  console.log(`  ${url}\n`);
  console.log("Admins:");
  for (const a of ADMINS) {
    console.log(`  ${a.email.padEnd(30)} — ${a.full_name}`);
  }
  console.log("");

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });
  const answer = await rl.question(
    'Type "yes" to continue, anything else to abort: ',
  );
  rl.close();
  if (answer.trim().toLowerCase() !== "yes") {
    console.log("Aborted.");
    process.exit(0);
  }

  const sb = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  console.log("");
  for (const admin of ADMINS) {
    try {
      await seedAdmin(sb, admin);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.error(`[fail] ${admin.email}: ${message}`);
      process.exit(1);
    }
  }

  console.log(
    `\nSeeded ${ADMINS.length} admin accounts. They can now sign in via magic link at ${url}.`,
  );
  console.log('Tell them to click "Sign in" (not Register) on first visit.');
}

async function seedAdmin(
  sb: SupabaseClient<Database>,
  admin: (typeof ADMINS)[number],
) {
  const { email, full_name, student_id } = admin;

  // 1. Detect existing auth user. listUsers paginates; for a freshly-
  //    deployed prod with effectively zero users, page 1 is sufficient.
  //    If the prod project ever exceeds 200 users, switch to pagination
  //    or the email-filter form once it lands in @supabase/supabase-js.
  const { data: list, error: listErr } = await sb.auth.admin.listUsers({
    perPage: 200,
  });
  if (listErr) throw listErr;

  let userId: string;
  const existing = list.users.find((u) => u.email === email);
  if (existing) {
    console.log(`[skip create] ${email} already exists, will upsert profile`);
    userId = existing.id;
  } else {
    const { data: created, error: createErr } = await sb.auth.admin.createUser({
      email,
      email_confirm: true,
      user_metadata: { full_name, student_id },
    });
    if (createErr) throw createErr;
    if (!created.user) throw new Error("createUser returned no user");
    userId = created.user.id;
  }

  // 2. Upsert profile. handle_new_user trigger inserted a pending_email
  //    row when the auth user was created; this UPDATE forces the final
  //    state and is the authoritative write. For orphaned auth users
  //    (created without the trigger firing), fall through to INSERT.
  const { data: existingProfile, error: fetchErr } = await sb
    .from("profiles")
    .select("approved_at")
    .eq("id", userId)
    .maybeSingle();
  if (fetchErr) throw fetchErr;

  const approvedAt = existingProfile?.approved_at ?? new Date().toISOString();

  if (existingProfile) {
    const { error: updateErr } = await sb
      .from("profiles")
      .update({
        full_name,
        student_id,
        status: "approved",
        is_admin: true,
        approved_at: approvedAt,
      })
      .eq("id", userId);
    if (updateErr) throw updateErr;
  } else {
    const { error: insertErr } = await sb.from("profiles").insert({
      id: userId,
      email,
      full_name,
      student_id,
      status: "approved",
      is_admin: true,
      approved_at: approvedAt,
    });
    if (insertErr) throw insertErr;
  }

  // 3. Verify by re-fetching. Structural failure (bad FK, missing
  //    trigger, typo) bubbles up as exit 1.
  const { data: verified, error: verifyErr } = await sb
    .from("profiles")
    .select("id, status, is_admin")
    .eq("id", userId)
    .single();
  if (verifyErr) throw verifyErr;
  if (verified.status !== "approved" || verified.is_admin !== true) {
    throw new Error(
      `verification failed: status=${verified.status}, is_admin=${verified.is_admin}`,
    );
  }

  const idShort = verified.id.slice(0, 8);
  console.log(`[ok] ${email} → approved beadle (profile id: ${idShort}…)`);
}

main().catch((err) => {
  const message = err instanceof Error ? err.message : String(err);
  console.error(message);
  process.exit(1);
});
