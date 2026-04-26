# Phase 1.5 Summary — Foundation Hardening

A focused follow-up to Phase 1. No new features, no UI. Three architectural smells eliminated and a handful of cleanups, before Phase 2 wires the auth flow and Phase 3 wires the ranking UI.

## What shipped

### Atomic ballot submission

- `supabase/migrations/0008_ballot_function.sql` — new `submit_ballot(p_rankings jsonb)` Postgres function. `security definer` so it can write to `audit_log`. Reads `auth.uid()` for caller identity. Validates eligibility (approved + assigned topic), the rankings shape (non-empty array, no duplicate ranks, no duplicate topics, every `topicId` exists), and ballot lock state. Get-or-creates the caller's ballot, takes `FOR UPDATE` on the row to serialise concurrent same-user submits, replaces rankings, sets `submitted_at = now()`, writes one audit row — all in a single transaction. Discrete error codes (`NOT_AUTHENTICATED`, `NOT_ELIGIBLE`, `EMPTY_BALLOT`, `DUPLICATE_RANK`, `DUPLICATE_TOPIC`, `INVALID_TOPIC`, `BALLOT_LOCKED`, `INVALID_RANKINGS`).
- `lib/actions/ballot.ts` — rewritten to a thin RPC caller. No more `createServiceClient()`. Maps the function's exception strings to user-facing error messages.

### Atomic tally writes (IRV stays in TS)

- `supabase/migrations/0009_tally_function.sql` — new `write_tally_results(p_results jsonb, p_total_ballots int)` function. `security definer`, gated on `is_admin`. Takes `FOR UPDATE` on `voting_state` row 1 so concurrent admin invocations queue. Clears `tally_results`, inserts the per-run rows from the JSON payload, bumps `voting_state.tally_run_at`, writes one audit row.
- `lib/actions/tally.ts` — service-role is now scoped to the cross-user reads only (ballots + rankings), which is the legitimate escape hatch. After computing `tally()` in TS, the writes go through the new RPC on the user-scoped client. Dropped the `JSON.parse(JSON.stringify(...))` deep clone — `RoundResult[]` is already POJO.
- `lib/irv.ts` — `tally()` is now pure. `computedAt` is an optional fourth parameter (default `""`); the caller in `tally.ts` passes `new Date().toISOString()`. Existing tests strip the field, so they pass unchanged.

### Cleanups

- `supabase/migrations/0010_policy_cleanup.sql` — renames the SELECT policy `ballots_admin_view_read` (on the `ballots` *table*) to `ballots_admin_read`, and drops the unused `ballots_admin_view` view. Application code never queried it; only `database.types.ts` carried it as an FK metadata artefact.
- `package.json` — removed the redundant `db:seed` script (it was an alias for `db:reset` with a misleading name).
- `specs/supabase-setup.md` — one-line note that the seed migration runs as part of `db:reset`; there is no separate seed step.
- `specs/phase-1-summary.md` — Next.js version corrected from 15.2.4 to 16.2.4.

## Migration count

Now at 10 (was 7). New: 0008, 0009, 0010. None of the existing seven were edited.

## Acceptance criteria

- [x] `npm run test` — 10 IRV fixtures + snapshot all pass.
- [x] `npm run lint` — zero errors.
- [x] `npm run typecheck` — zero errors.
- [x] `npm run build` — succeeds.
- [x] `supabase db reset` — all 10 migrations apply cleanly.
- [x] `submit_ballot` and `write_tally_results` visible via `\df` in the local DB.
- [x] `lib/actions/ballot.ts` no longer creates a service-role client.
- [x] `lib/actions/tally.ts` uses service-role only for cross-user reads (ballots + rankings); writes go through the user-scoped RPC.
- [x] `lib/irv.ts` does not call `new Date()` inside `tally()`.
- [x] `0004_rls_policies.sql` and `0007_views.sql` left untouched.
- [x] `db:seed` script removed from `package.json`.
- [x] `specs/phase-1-summary.md` shows correct Next.js version.

## Deviations from the brief

1. **`as never` cast on the RPC args** in both `ballot.ts` and `tally.ts`. The installed supabase-js (`@supabase/supabase-js@2.49.8` → `@supabase/postgrest-js@2.104.1`) has a typing quirk where the `Args` generic on `rpc<>` defaults to `never` when TS can't infer it from the second positional argument. I tried explicit type parameters and a typed args local — both still failed the `extends never` constraint check. The cast is the standard workaround in the Supabase ecosystem; runtime is unaffected because supabase-js JSON-encodes whatever payload you pass. A comment in `ballot.ts` flags this. Worth revisiting on the next supabase-js bump.

2. **`computedAt` as an optional parameter (not a removed field).** The brief offered two options. I chose the optional-parameter variant so `TallyResult`'s shape stays stable — the existing test helper `strip = (r) => ({ ...r, computedAt: undefined })` keeps working untouched. Removing the field would have rippled into the type, the snapshot, and the `tally_results` insert path. Default is `""`.

3. **`p_results` keys are snake_case in TS before the RPC call.** The brief left this as a coin flip. Translating in TS keeps the SQL function readable — it just selects `entry->>'run_num'`, `entry->>'winner_topic_id'`, etc. Documented in the SQL function comments.

4. **Same-user submit serialisation.** Brief didn't ask for it, but I added `select … for update` on the ballot row inside `submit_ballot` to defend against the same user double-clicking submit. Zero external behaviour change; nothing else needs to know.

5. **Phase 1 summary was only patched for the version, not the broader staleness.** The "What shipped" list still lists `db:seed` and stops at `0007_views.sql`. The brief asked for the version fix only — flagging in case you want a wider sync.

## What Phase 2 (auth) should know

- The `submit_ballot` RPC is the only path for ballot writes from the app. It enforces the eligibility rule ("approved AND has assigned topic") server-side, so Phase 2 doesn't need to gate the action on the client beyond the obvious UX hide.
- The function relies on `auth.uid()` reading the caller's JWT. As long as the magic-link flow lands the user with a valid session and `lib/supabase/server.ts`'s cookie-based `createClient()` is what server actions call, this Just Works.
- The error strings raised from inside `submit_ballot` are stable identifiers (`NOT_AUTHENTICATED`, etc.). Phase 2 / Phase 3 can rely on the message-to-user-string mapping in `ballot.ts` or build their own.

## What Phase 3 (voter UI) should know

- `submitBallot(rankings)` is now atomic — no more partial writes if the connection drops mid-submit. The UI can present "submitted" with confidence the moment the action returns without an error.
- `BALLOT_LOCKED` is the error code the UI should treat as terminal (already-submitted state). Everything else is either a validation bug or a transient failure.
- Concurrent submits from the same user (double-click) are serialised; the second call will fail with `BALLOT_LOCKED` cleanly. Disable the button on optimistic submit anyway.
- Draft-ballot writes (saving rankings *before* final submission) still go through the existing `rankings`-table RLS policies. Phase 3 will need its own server action(s) for upsert-rankings-without-locking. That action shouldn't reuse `submit_ballot` — it sets `submitted_at`, which locks the ballot.

## What Phase 6 (admin views) should know

- The renamed policy is `ballots_admin_read`. Admin queries should hit `ballots` directly (selecting `id, voter_id, submitted_at, locked_at, created_at, updated_at`); there's no more `ballots_admin_view`. Column-level secrecy isn't enforced — `ballots` has no sensitive columns. The secrecy boundary is `rankings`, which has no admin SELECT policy at all.
- `runTally()` is now safe under concurrent invocation — two beadles racing to click "Run tally" will serialise on the `voting_state` row lock. The second invocation sees the first's results and overwrites them deterministically.

## Open questions

None. Phase 2 can start immediately.
