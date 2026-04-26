# Agora — Phase 1 Handoff (Foundation)

This is your starting brief. Phase 1 establishes the scaffold, schema, and tally algorithm. **No UI screens** beyond a stub homepage — auth comes in Phase 2, voter screens in Phase 3.

---

## Read first, in order

1. `agora/CLAUDE.md` — full project context, conventions, communication style.
2. `agora/specs/schema.md` — authoritative for tables, RLS, triggers, storage.
3. `agora/specs/irv-spec.md` — authoritative for the tally algorithm; matches the test fixtures exactly.
4. `agora/specs/design-corrections.md` — build-time fixes from the design review.
5. `agora/Agora.html` + `agora/src/styles.css` — visual reference. Read-only. Don't modify.
6. `agora/src/data.jsx` — the canonical 32 topics. Use this as the source for the seed migration.

If anything in the specs feels ambiguous or contradictory, **stop and flag it** before improvising.

---

## Goal

By the end of Phase 1, the project should:

- Build, lint, and test cleanly on a fresh checkout.
- Apply all migrations to a fresh Supabase project without errors.
- Pass every IRV test from `irv-spec.md` (10 fixtures + a snapshot test).
- Render a single stub homepage at `/` with the design palette and fonts loaded.
- Have a `/api/health` route that confirms Supabase connectivity.

No auth flows. No drag-and-drop. No admin views. Phase 1 is foundation only.

---

## Deliverables

### 1. Project scaffold

- Next.js 15 with App Router, TypeScript strict mode.
- Tailwind CSS configured. Transcribe design tokens from `src/styles.css` into `tailwind.config.ts` (colours, font families, radii, shadows). Inter and Source Serif 4 loaded via `next/font`.
- ESLint + Prettier set up with sensible defaults for Next.js 15.
- Vitest installed and wired (not Jest — Vitest is fastest with TS strict).
- `package.json` scripts: `dev`, `build`, `start`, `lint`, `test`, `typecheck`, `db:reset`, `db:migrate`, `db:seed`, `db:types`.
- `.env.example` documenting every required env var.
- `.gitignore` covering `.env.local`, `.next`, `node_modules`, `coverage`, etc.
- Initial commit with the folder layout from `CLAUDE.md`.

### 2. Pure-TypeScript IRV implementation

- `lib/irv.ts` — pure function `tally(ballots, topics, positions = 5)` per the TypeScript signature in `irv-spec.md`. No I/O, no randomness, no time inside the algorithm.
- `lib/irv.test.ts` — implement all 10 test fixtures from `irv-spec.md`. Test 9 (large realistic scenario) uses a fixed-seed PRNG (e.g. `seedrandom`) — commit both the seed and a snapshot of the expected `TallyResult`.
- All tests must pass. `npm run test` is green.

This is the highest-stakes piece of the system. **Do this before the schema work.** It's a pure function — easier to validate in isolation.

### 3. Supabase setup

- Use Supabase CLI (`supabase init`, `supabase start`) for local development. Document the steps in a short `agora/specs/supabase-setup.md` you write.
- Configure `lib/supabase/server.ts` and `lib/supabase/client.ts` using `@supabase/ssr`. No deprecated `auth-helpers-*` packages.
- `supabase gen types typescript` produces `lib/supabase/database.types.ts`. Wire this into the helpers so all DB calls are typed.

### 4. Schema migrations

Under `db/migrations/`:

- `0001_initial_schema.sql` — all tables, enums, constraints, indexes from `schema.md`.
- `0002_triggers.sql` — `handle_new_user`, `handle_email_confirmed`, `set_updated_at` (applied to `profiles`, `topics`, `notes`, `ballots`, `voting_state`).
- `0003_helpers.sql` — `is_approved()`, `is_admin()` SQL helper functions.
- `0004_rls_policies.sql` — every RLS policy from `schema.md`. Pay particular attention to the `rankings` and `ballots` secrecy boundary: admins must not be able to read individual rankings.
- `0005_storage.sql` — `presentations` bucket and policies.
- `0006_seed_topics.sql` — idempotent insert of the 32 topics from `src/data.jsx`. Use `ON CONFLICT (id) DO NOTHING`.
- `0007_views.sql` — `ballots_admin_view` if needed for the admin UI's column-restricted access.

Each migration must be runnable in isolation against a fresh database. No mid-file `IF EXISTS` hacks.

### 5. Server-side functions

Implement in `lib/actions/` as Next.js Server Actions, calling into Postgres functions where it makes sense:

- `approve_voter(target_id, topic_id, is_admin = false)`
- `approve_non_voter(target_id, is_admin = true)` — used for the professor
- `reject_voter(target_id, reason)`
- `assign_topic(target_id, topic_id)` — for reassignment
- `mark_topic_presented(topic_id)`
- `submit_ballot(rankings)` — validates (no duplicate ranks, all topic_ids exist, voter has assigned topic) before writing
- `unlock_ballot(target_voter_id)` — admin only, clears `submitted_at` and `locked_at`
- `lock_ballots()` — admin only
- `run_tally()` — admin only, reads ballots via `service_role`, calls `tally()` from `lib/irv.ts`, writes `tally_results` in a transaction
- `set_deadline(deadline)` — admin only

Stubs are acceptable for actions Phase 1 doesn't actively need (i.e. those returning `not implemented` errors, with a TODO referencing the phase that wires them). The functions called from Phase 1's tests must be fully implemented: `submit_ballot`, `run_tally`.

Every function that mutates writes to `audit_log`.

### 6. Health check + stub homepage

- `/api/health` — server route that pings Supabase (e.g. selects `count(*)` from `topics`), returns `{ ok: true, topics: 32 }` or a 500 with an error message.
- `/` — a single-line page: serif "Agora" wordmark, Inter subtitle "Phase 1 ready", design palette swatches as a debug aid. Confirms Tailwind config and font loading work end to end.

---

## Acceptance criteria

Phase 1 ships when **all** of these are true:

- [ ] `npm install` clean install with no warnings about deprecated packages.
- [ ] `npm run lint` passes with zero errors and zero warnings.
- [ ] `npm run typecheck` passes with zero errors.
- [ ] `npm run test` passes — all 10 IRV fixtures plus the snapshot test.
- [ ] `npm run build` succeeds.
- [ ] `supabase db reset` applies all migrations cleanly to a fresh local Supabase instance.
- [ ] `supabase gen types typescript --local` produces a non-empty `database.types.ts`.
- [ ] After migrations + seed, `select count(*) from topics` returns 32.
- [ ] After migrations + seed, the `presentations` storage bucket exists.
- [ ] `/api/health` returns 200 with the expected payload against the local Supabase.
- [ ] `/` renders the stub with Inter and Source Serif 4 visible.
- [ ] Git history shows logical commits (not one mega-commit).

---

## Non-goals for Phase 1

Anything in this list is explicitly out of scope. If you find yourself building toward it, stop and ask.

- Auth UI (register, sign-in, awaiting-approval, etc.)
- Dashboard, topic detail, ranking page, profile, presenter upload
- Admin views (approval queue, voters, topics admin, voting controls, results)
- Any drag-and-drop logic
- Email templates
- Production Supabase project / Vercel deployment
- Custom domain, analytics, monitoring

---

## Conventions reminder

(See `CLAUDE.md` for the full list. The ones most relevant to Phase 1.)

- File names: lowercase, hyphens.
- Database columns: snake_case. TypeScript: camelCase. Use the generated types.
- Migrations are **append only**. Never edit a committed migration; write a new one.
- No `any` without a comment justifying it.
- Default to server components. Phase 1 doesn't need many client components yet (just the stub homepage if you choose).
- Server Actions for mutations.

---

## Reporting

- **Plan first.** Before any code, post a short plan: ordering of work, libraries you intend to add, anything ambiguous you want flagged.
- **Wait for the green light** from Francis before executing.
- **Checkpoint at logical breakpoints**: after the scaffold, after IRV tests pass, after migrations apply cleanly. Each checkpoint is a chance for review.
- **End with a hand-off doc.** When Phase 1 is done, write `agora/specs/phase-1-summary.md`:
  - What shipped, with file paths.
  - Any deviations from the spec, with justification.
  - Open questions for Francis.
  - Required env vars and where to set them.
  - Anything that would block Phase 2 (auth) — known issues, missing pieces.

---

## Things to flag immediately, not improvise

- Any conflict between `schema.md` and `irv-spec.md`.
- Any case where the design prototype's behaviour contradicts the specs.
- Library choices that aren't named here (drag-and-drop, charts, anything substantial).
- Any data loss risk during migrations.
- Anything in the specs that strikes you as architecturally off.

You're working with a senior reviewer. Wrong-but-flagged is far better than wrong-and-shipped.
