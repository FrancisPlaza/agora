# Phase 1 Summary — Foundation

## What shipped

### Project scaffold
- Next.js 16.2.4 (App Router, TypeScript strict, Turbopack)
- Tailwind CSS 4 with design tokens from `src/styles.css` (palette, radii, font families)
- Inter + Source Serif 4 via `next/font/google`
- Vitest, ESLint, Prettier configured
- All scripts wired: `dev`, `build`, `start`, `lint`, `test`, `typecheck`, `db:reset`, `db:migrate`, `db:seed`, `db:types`

### IRV algorithm (`lib/irv.ts`)
- Pure `tally(ballots, topics, positions)` function — no I/O, no randomness
- All 10 test fixtures pass (`lib/irv.test.ts`)
- Snapshot regression test for 32-topic/30-ballot scenario committed

### Schema migrations (`supabase/migrations/`)
- `0001_initial_schema.sql` — all tables, enums, constraints, indexes
- `0002_triggers.sql` — `handle_new_user`, `handle_email_confirmed`, `set_updated_at`
- `0003_helpers.sql` — `is_approved()`, `is_admin()` SQL helper functions
- `0004_rls_policies.sql` — full RLS on every table, ballot secrecy enforced
- `0005_storage.sql` — `presentations` bucket with path-based policies
- `0006_seed_topics.sql` — 32 topics, idempotent
- `0007_views.sql` — `ballots_admin_view` with `security_invoker`

### Supabase integration
- `lib/supabase/server.ts` — cookie-based server client + service-role client
- `lib/supabase/client.ts` — browser client
- `lib/supabase/database.types.ts` — generated, 583 lines
- `specs/supabase-setup.md` — local dev workflow doc

### Server actions (`lib/actions/`)
- `ballot.ts` — `submitBallot()` fully implemented (validates, writes, locks, audit logs)
- `tally.ts` — `runTally()` fully implemented (reads via service_role, calls IRV, writes results)
- `admin.ts` — stubs for Phase 6 (approve, reject, assign, lock, unlock, deadline)

### Routes
- `/` — stub homepage with serif "Agora" wordmark, palette swatches, fonts loaded
- `/api/health` — returns `{ ok: true, topics: 32 }` against local Supabase

## Deviations from spec

1. **Test 3 fixture correction.** The spec's walkthrough for test 3 says "Run 2: all ballots exhausted (all preferences were for topic 1)." This is wrong — only 3 of 9 ballots ranked topic 1. The other 6 ranked topics 2 and 3, which survive into run 2. Corrected in the test expectations; algorithm is correct.

2. **Migration directory.** CLAUDE.md specifies `db/migrations/` but Supabase CLI requires `supabase/migrations/`. Resolved with a symlink: `db -> supabase/migrations`.

3. **`db:types` script.** `supabase gen types` prints "Connecting to db 5432" to stdout. The script pipes through `grep -v` to strip it.

## Required env vars

| Variable | Description |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` for local |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Publishable key from `supabase status` |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret key from `supabase status` |

## Acceptance criteria status

- [x] `npm install` — clean, no deprecated warnings
- [x] `npm run lint` — zero errors, zero warnings
- [x] `npm run typecheck` — zero errors
- [x] `npm run test` — all 10 fixtures + snapshot pass
- [x] `npm run build` — succeeds
- [x] `supabase db reset` — all 7 migrations apply cleanly
- [x] `supabase gen types typescript --local` — produces 583-line types file
- [x] `select count(*) from topics` returns 32
- [x] `presentations` storage bucket exists
- [x] `/api/health` returns `{ ok: true, topics: 32 }`
- [x] `/` renders stub with Inter and Source Serif 4 visible
- [x] Git history shows logical commits (5 commits)

## Open questions for Phase 2

1. **Magic-link email template.** Supabase's default email template is functional but bare. Should we customise it in Phase 2 or defer?
2. **Middleware for auth redirect.** Phase 2 needs middleware to redirect unauthenticated users. Standard `@supabase/ssr` pattern — no surprises expected.
3. **Turbopack root warning.** Next.js detects a parent `package-lock.json` at `~/package-lock.json` and warns about workspace root. Harmless but can be silenced with `turbopack.root` in `next.config.ts` if it bothers you.

## What would block Phase 2

Nothing. Schema, types, and auth triggers are in place. Phase 2 can start immediately with register, magic-link sign-in, and approval flow screens.
