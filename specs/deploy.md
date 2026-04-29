# Agora — Deployment Runbook

End-to-end recipe for taking the repo from "fresh clone" to a running sandbox on Vercel + cloud Supabase. Production deploys follow the same steps with the substitutions in **Production deploy checklist** at the bottom.

This runbook is the source of truth. If a step here is wrong, fix the runbook first, then re-deploy.

---

## What you deploy

- **Sandbox**: a throwaway Vercel project + a fresh Supabase project, populated with synthetic data via `scripts/seed-sandbox.ts`. No real student data. The site URL is shareable for review but not announced to the class.
- **Production** (later, separate review): a long-lived Vercel project + a separate Supabase project, custom domain, real bootstrap. **Do not run `scripts/seed-sandbox.ts` against production.** The script's safety guard refuses unless the URL is local or `AGORA_SEED_OK=true` is explicitly set; even then, manual review of the URL is required before override.

---

## Prerequisites

- A Supabase account with permission to create new projects.
- A Vercel account with permission to create new projects.
- The Supabase CLI installed locally (`brew install supabase/tap/supabase`) and `supabase --version` ≥ 1.150.
- A clean working tree on the branch you intend to deploy (typically `main`).

---

## Step 1 — Create the Supabase project

1. In the Supabase dashboard, **New project**. Name it something obviously sandbox-flavoured (e.g. `agora-sandbox`).
2. Region: choose one near you. Plan: free tier is fine for sandbox.
3. Set a strong database password and store it in a password manager.
4. Wait for the project to provision (~2 minutes).

Once the project is up, capture three values from **Project Settings → API**:

- `Project URL` → becomes `NEXT_PUBLIC_SUPABASE_URL`.
- `anon` `public` API key → becomes `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
- `service_role` `secret` key → becomes `SUPABASE_SERVICE_ROLE_KEY`. **Never** check this into the repo or expose it to the browser.

The project ref is the slug in the URL (e.g. `qbxctfxiwrptrutfcpse`). Copy it for the CLI link step.

---

## Step 2 — Apply migrations to the sandbox project

From the repo root:

```bash
# Authenticate the CLI once.
supabase login

# Link this repo to the sandbox project.
supabase link --project-ref <YOUR_PROJECT_REF>
# (paste the database password from step 1 when prompted)

# Push every migration in supabase/migrations/ to the cloud DB.
supabase db push
```

What this does: the CLI sees 16 migration files (`0001_initial_schema.sql` through `0016_fix_tally_delete_clause.sql`), confirms the cloud DB is empty, and applies them in order. The 32 topic seeds in `0006_seed_topics.sql` land as part of the push.

After the push, sanity-check from the SQL editor:

```sql
select count(*) from public.topics;        -- expect 32
select id, polls_locked from public.voting_state;  -- expect 1, false
\df public.submit_ballot                    -- expect one row
\df public.write_tally_results              -- expect one row
\df public.approve_voter                    -- expect one row
```

Verify the storage bucket exists at **Storage → Buckets → `presentations`**. It should be private, with the policies from `0005_storage.sql`. If it's missing the bucket got dropped by something — re-run `supabase db push --include-all` or recreate it manually from `0005_storage.sql`.

---

## Step 3 — Configure Auth in the Supabase dashboard

In **Authentication → URL Configuration**:

- **Site URL** → the sandbox Vercel URL you'll create in step 4 (you'll have to come back and update this once Vercel assigns a URL — see step 4.5).
- **Redirect URLs** → add `<sandbox-vercel-url>/auth/callback`. Wildcard variants like `<sandbox-vercel-url>/**` work too.

Auth → Providers → **Email**: keep magic link enabled. Disable email-confirmation requirement if you want auto-confirmed sign-ups during dev (cloud Supabase respects this; local dev always auto-confirms regardless).

**Email templates** — Supabase defaults are functional. Customise later if needed.

---

## Step 4 — Create the Vercel project

1. In Vercel, **Add new → Project**. Import the `agora` GitHub repo. Vercel detects Next.js automatically.
2. Framework preset: Next.js (auto). Root directory: leave as repo root. Build command: leave default. Output directory: leave default.
3. **Environment variables** — set these for the **Production** environment (the only env on a sandbox Vercel project):

   | Variable | Value | Notes |
   |---|---|---|
   | `NEXT_PUBLIC_SUPABASE_URL` | from step 1 | public, ok in client bundle |
   | `NEXT_PUBLIC_SUPABASE_ANON_KEY` | from step 1 | public |
   | `SUPABASE_SERVICE_ROLE_KEY` | from step 1 | **server-only** — never use in a `NEXT_PUBLIC_*` |
   | `NEXT_PUBLIC_SITE_URL` | the sandbox Vercel URL (no trailing slash) | needed for the magic-link callback |
   | `NEXT_PUBLIC_BEADLE_CONTACT` | placeholder for the rejected screen, e.g. `Beadle Lim · jlim@sanbeda.edu.ph` | newline-separated lines accepted |
   | `NEXT_PUBLIC_REPO_URL` | `https://github.com/FrancisPlaza/agora` (or your fork) | landing footer "Source on GitHub" link; leave empty to omit |

4. Click **Deploy**. The first build takes ~2–3 minutes.

### Step 4.5 — Pin the Auth Site URL

Once Vercel assigns a URL (e.g. `agora-sandbox.vercel.app`), go back to **Supabase → Authentication → URL Configuration** and set Site URL + Redirect URLs to that value with `/auth/callback` appended. Otherwise the magic link will redirect users to the wrong URL and the PKCE flow will fail.

---

## Step 5 — First-deploy smoke check

Visit the sandbox URL. Confirm:

- Landing page renders with the wordmark and CTAs.
- Click "Register", submit a real (or test) email + name + student ID.
- Check the inbox of that email; the magic link should land at `<sandbox-url>/auth/callback?code=...`.
- After clicking the link, you land on `/awaiting-approval`. Profile row exists in `public.profiles` with `status='pending_approval'`.

If any of these fail, the Auth URL configuration in step 3 is the most common culprit.

---

## Step 6 — Bootstrap the test beadle

The only remaining manual SQL step. After the test user signs up via magic link, in **Supabase → SQL editor**:

```sql
update public.profiles
   set status = 'approved',
       is_admin = true,
       approved_at = now()
 where email = '<your-test-beadle-email>';
```

Reload the sandbox in the browser. The Admin link should now be in the top nav.

---

## Step 7 — Populate the dry-run via `seed-sandbox.ts`

The script creates 10 fake voter accounts, assigns topics, marks 6 presented (4 with placeholder artwork), inserts 5 synthetic submitted ballots, opens polls, locks them, and runs the IRV tally — so reviewers see a fully-populated state without 30 manual register-approve flows.

```bash
# From the repo root.
export SUPABASE_URL='https://<your-project-ref>.supabase.co'
export SUPABASE_SERVICE_ROLE_KEY='<your-service-role-key>'

# Safety guard: refuses to run against a non-local URL unless this is set.
# Triple-check SUPABASE_URL before exporting this.
export AGORA_SEED_OK=true

npx tsx scripts/seed-sandbox.ts
```

Output enumerates the seeded accounts (`seed-voter1@sanbeda.edu.ph` through `seed-voter10@sanbeda.edu.ph`) and the IRV winner of each run. The first seed voter (`seed-voter1@sanbeda.edu.ph`) is also flagged as admin so reviewers don't have to repeat the bootstrap step.

The script is **idempotent**: re-runs detect existing seed users by email and skip the create step; ballots / tally are wiped and rewritten so the resulting state is reproducible.

To clean up entirely (e.g. before reseeding from scratch):

```sql
-- Run in Supabase SQL editor
delete from public.rankings;
delete from public.ballots;
delete from public.tally_results;
update public.voting_state set polls_open_at = null, deadline_at = null,
       polls_locked = false, polls_locked_at = null, polls_locked_by = null,
       tally_run_at = null where id = 1;
update public.topics set presenter_voter_id = null, presented_at = null,
       art_title = null, art_explanation = null, art_image_path = null,
       art_uploaded_at = null;
delete from auth.users where email like 'seed-%@sanbeda.edu.ph';
-- profiles cascade-deletes via the FK on auth.users
```

The script's safety guard: it aborts unless `SUPABASE_URL` contains `127.0.0.1` (local) OR `AGORA_SEED_OK=true` is set. The override is intentional friction; never set the env var in a CI/automation context.

---

## Step 8 — End-to-end verification on the sandbox

Walk the full flow:

1. Sign in as the bootstrapped beadle (your real email from step 6, or `seed-voter1@sanbeda.edu.ph` from step 7).
2. `/dashboard` shows 32 topic cards. Top-5 medals appear after step 7's tally.
3. `/admin/voters` lists the seeded voters.
4. `/admin/topics` shows the assigned + presented + published topics.
5. `/admin/voting` shows submission progress and lets you re-run the tally.
6. `/results` renders the podium and per-run timelines. Switch tabs (`?run=2..5`).
7. Download `/api/results/top-5.csv` and `/api/results/rounds.csv`. Inspect the file.
8. `Cmd+P` (or `Ctrl+P`) on the results page → Save as PDF. The print should hide nav and the run-tabs strip; only podium + the active timeline render.

If any step fails, the symptom usually points at one of: env var missing, Auth URL config, bucket policies missing, or a stale browser cache (try incognito).

---

## Production deploy checklist

When Francis approves the sandbox and you're ready to deploy production:

| Step | Sandbox | Production |
|---|---|---|
| Supabase project | `agora-sandbox` | `agora-production` (separate project) |
| Vercel project | `agora-sandbox` | `agora-production` (separate project) |
| Custom domain | none (uses `<slug>.vercel.app`) | configure in Vercel → Domains |
| Auth Site URL | `<sandbox-vercel-url>` | the custom domain |
| Auth email templates | defaults | review and customise per Phase 2 hand-off |
| `NEXT_PUBLIC_BEADLE_CONTACT` | placeholder | the real beadle contact line(s) |
| Bootstrap admin SQL | run for sandbox beadle | run for the real Beadle Lim + Beadle Cruz |
| `scripts/seed-sandbox.ts` | run once | **never run** — the safety guard refuses without an override |

The production rollout adds these steps:

1. **Custom domain.** Buy / map the domain. Update Vercel and Auth URL Configuration to use it.
2. **Privacy review.** Real student data lands in production; confirm Supabase region complies with class data policy.
3. **Backups.** Confirm Supabase's daily snapshot policy is on. The free tier may not cover this.
4. **Email deliverability.** Supabase's default transactional email has a low send quota. For a 32-student class it's fine, but verify the domain isn't getting throttled.
5. **Two real beadle accounts.** Both promoted via SQL. Document who they are in this file under a "Production beadles" section.
6. **A run-of-show.** The class needs a calendar of when polls open and when they close. Coordinate before flipping `voting_state`.

The code itself is the same on both deploys. Migrations are the same. The data isn't.

---

## Troubleshooting

**"PKCE code verifier not found in storage"** on the magic-link callback. The Auth Site URL or Redirect URLs in step 3 don't match the actual sandbox URL. Fix the config + retry from a fresh incognito window.

**"DELETE requires a WHERE clause"** if `runTally` errors. This was fixed in migration `0016` — confirm the cloud DB is on `0016`.

**`pdfjs-dist` worker fails on the upload page.** Phase 5 uses a Turbopack-resolved worker URL. If the production build doesn't bundle the worker, the dynamic-import-on-pick path falls back to slower main-thread rendering. Should not happen on Next 16; if it does, check the build logs for a worker URL warning.

**Storage signed URL transforms (`?width=...&height=...`) don't return resized images.** The cloud Supabase project has imgproxy enabled by default; local dev does not. Behaviour mismatch is expected.

**Stale data after a deploy.** All `revalidatePath` calls run server-side; if a user sees stale state, they may be on a CDN-cached HTML page. Hard reload or wait for the route's TTL.
