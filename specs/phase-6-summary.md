# Phase 6 Summary — Admin (Beadle) Views

The biggest scope phase yet. Five admin pages, nine admin Postgres functions replacing the SQL stand-ins prior phases relied on, a defense-in-depth fix to `submit_ballot`, the corresponding TS server actions, an admin-only middleware gate, and an Admin link in the top + bottom nav. After this phase, every transition prior phases needed manual SQL for has real UI — except the one-off `is_admin = true` bootstrap.

End-to-end verified in a real browser against local Supabase + Mailpit, including approval, mark-presented, set-deadline, open-polls, lock-ballots, and run-tally.

## What shipped

### Postgres functions

- `supabase/migrations/0014_admin_functions.sql` — eight admin functions: `approve_voter`, `reject_voter`, `assign_topic`, `mark_topic_presented`, `lock_ballots`, `unlock_ballot`, `set_deadline`, `open_polls`. All `security definer` with `set search_path = public, auth`. All gate on `is_admin()` and raise `'ADMIN_REQUIRED'` otherwise. All write one `audit_log` row at the end. None read or write `rankings` — ballot secrecy preserved.
- `supabase/migrations/0015_submit_ballot_polls_gate.sql` — the Phase 4 review's defense-in-depth fix. `submit_ballot` now raises `'POLLS_CLOSED'` if voting_state is locked or past deadline, and `'POLLS_NOT_OPEN'` if `polls_open_at` is null or in the future. Checks run before the existing eligibility/lock checks.
- `supabase/migrations/0016_fix_tally_delete_clause.sql` — see Deviations.

### Server actions

- `lib/actions/admin.ts` — full rewrite of the Phase 1 stubs. Nine actions matching the eight Postgres functions plus `runTallyFromAdmin` (wraps the existing `runTally` so the admin button can `redirect('/admin/results')` without touching `tally.ts`). Storage cleanup orchestration in `assignTopic` uses the service-role client to `list+remove` under `{topicId}/` after the row clears — best-effort, documented as self-healing on failure.
- `lib/actions/ballot.ts` — `ERROR_MESSAGES` extended for `POLLS_CLOSED` and `POLLS_NOT_OPEN`.

### Data helpers

- `lib/data/admin.ts` — five `cache()`'d read helpers: `getPendingApprovals`, `getAllVoters`, `getAuditLog`, `getAdminSummary`, `getUnassignedTopics`. Voter list joins to `topics` (assigned-topic display) and to `ballots` (status derivation). Ballot select is explicit — `submitted_at, locked_at` only, never `*`, never `rankings`.
- `lib/data/topics.ts` — `getMyTopic` now computes `class_note_count` properly (Phase 3 punt fixed).

### Middleware + helpers

- `middleware.ts` — selects `is_admin` alongside `status`. New `/admin/*` gate: must be approved AND `is_admin`. Existing routing table otherwise unchanged.
- `lib/auth.ts` — `requireAdmin()` — defensive backstop for `/admin/*` server components.

### UI

- `components/ui/confirm-dialog.tsx` — small client modal for destructive confirmations.
- `components/nav/{top,bottom}-nav.tsx` — gain `isAdmin` prop. When true, render a fourth Admin link/tab with violet active state.
- `app/(authed)/layout.tsx` — threads `profile.is_admin` into both navs.
- `app/(authed)/admin/layout.tsx` — sub-nav with five tabs (Home / Approvals / Voters / Topics / Voting). `requireAdmin()` at top.
- `app/(authed)/admin/page.tsx` — three summary cards + audit log timeline.
- `app/(authed)/admin/approvals/page.tsx` + `approval-row.tsx` — queue table with per-row Approve-as-voter / Approve-as-admin / Reject-with-reason.
- `app/(authed)/admin/voters/page.tsx` + `voter-row-actions.tsx` — chip-filtered voter list. Per-row Reassign + Unlock-ballot dialogs.
- `app/(authed)/admin/topics/page.tsx` + `topic-row-actions.tsx` — 32-row topics table. Per-row Mark-presented + Reassign actions.
- `app/(authed)/admin/voting/page.tsx` + `voting-controls.tsx` — three cards: submission progress (with bar), deadline + open-polls, lock + run-tally.
- `app/(authed)/admin/results/page.tsx` — Phase 7 stub. Reads `tally_results` and lists run #, winner topic id, exhausted count.

## Deviations from the brief

1. **Three migrations, not two.** Phase 1.5's `write_tally_results` (migration 0009) used `delete from tally_results;` (no WHERE). Supabase's safety check rejects unqualified DELETE/UPDATE inside RPC-invoked functions with "DELETE requires a WHERE clause". Phase 1.5 never exercised the end-to-end run-tally path against a real ballot; Phase 6 wired the Run-tally button and surfaced the error. Migration **`0016_fix_tally_delete_clause.sql`** adds a trivial always-true predicate (`where run_num between 1 and 5`) — semantics unchanged because the column is already constrained to that range. **Migration count is now 16.**

2. **`approve_voter` audit-action naming.** Brief offered two conventions; I chose `'approve_non_voter'` when `p_topic_id IS NULL`, `'approve_voter'` when set. The audit log is human-scannable; distinguishing "approved Andrea Reyes for topic 5" from "approved Prof. Cruz as non-voting admin" matters more than parameter discipline. Documented inline in 0014.

3. **`assign_topic` audit-action naming.** Function emits `'assign_topic'` for first-time assignment, `'reassign_topic'` when a prior owner existed. Same readability rationale as #2.

4. **Voter-list secrecy.** `getAllVoters` returns the assigned-topic shape but `topics` and `ballots` arrive from Supabase FK embeds as `null` (not `[]`) when there's no related row. Added `?? null` guards. Bug surfaced during browser verification; fixed in commit 5.

5. **Storage cleanup in `assignTopic`** — best-effort. If the storage `remove` fails after the DB row is cleared, the orphan files persist. They don't break anything (next reassignment's list+remove cleans them; the next presenter's upload deletes them via Phase 5's pre-upload sweep). Documented in the action's header.

6. **`open_polls` semantics.** Clears `polls_locked` / `polls_locked_at` / `polls_locked_by` but does NOT touch `ballots.locked_at`. Voters whose drafts were force-locked by a previous `lock_ballots()` call still need a per-voter `unlock_ballot()`. Documented in the function's comment.

## Manual SQL — only remaining bootstrap step

The one transition without UI by design: the initial admin promotion. New beadles are minted by SQL, intentionally — the brief says "beadles can't demote each other through the UI". After registering the beadle's account through the normal voter flow:

```sql
update public.profiles
   set is_admin = true
 where email = 'beadle@sanbeda.edu.ph';
```

That's the only SQL required after Phase 6.

## Acceptance criteria

- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` — all pass (30 tests).
- [x] `supabase db reset` works; **three new migrations** (0014, 0015, 0016 — see Deviations).
- [x] Every admin Postgres function is `security definer`, sets `search_path`, gates on `is_admin()`, and writes one `audit_log` row.
- [x] After registering a fresh user, an admin landed on `/admin/approvals`, picked a topic, and approved them — the user's profile flipped to `approved` with `presenter_voter_id` set.
- [x] Admin marked a topic presented from `/admin/topics` (verified in DB).
- [x] Admin set a deadline + opened polls from `/admin/voting`.
- [x] Admin locked ballots; verified `polls_locked = true` in DB.
- [x] Admin ran the tally; `tally_results` populated with 5 rows (1 winner, 4 vacant — synthetic single-ballot test); `/admin/results` stub renders the rows.
- [x] Calling `submit_ballot` from psql confirms the polls gate is in the function source (the auth check hits first when called directly without a session, but the new POLLS_CLOSED / POLLS_NOT_OPEN raises are present at lines 40-46 of the function body).
- [x] `/admin/*` is gated: signed in as `voter1` (non-admin), `/admin` redirected to `/dashboard`.
- [x] The top nav shows the Admin link only for `is_admin` users (verified by signing in as both beadle and voter).
- [x] No client-side data fetching beyond modal-state interactions and dialog confirmations. Admin tables are server-rendered.
- [x] Ballot secrecy holds. `grep -rEn 'from\("rankings"\)' app/(authed)/admin/ lib/data/admin.ts lib/actions/admin.ts` returns only the documentation comment in `lib/data/admin.ts` referencing the absence.

## What Phase 7 (results) needs to know

- **`tally_results` row shape after a real run.** Each row: `run_num` (1..5), `winner_topic_id` (int or null for vacant), `rounds` (jsonb — array of `RoundResult` per Phase 1's `lib/irv.ts`), `total_ballots` (int, identical across all rows from a single run), `exhausted` (int — final-round exhausted count from the corresponding run), `created_at`. Phase 7's display reads `rounds` for the round-by-round breakdown.
- **`rounds` jsonb shape.** Each entry has `round`, `candidates` (sorted array of `{topicId, votes, pct}`), `exhausted`, `totalActive`, `eliminated` (int or null), `winner` (int or null). Per `specs/irv-spec.md`'s `RoundResult` type.
- **`runTallyFromAdmin` redirects to `/admin/results` on success.** Phase 7's real results page can sit at the same route and the existing button just works. Or rename to `/admin/results/stub` and have Phase 7 take `/admin/results` cleanly.
- **No exports yet.** The brief mentions CSV / PDF as Phase 7 work; nothing here. The data is all in `tally_results.rounds` jsonb — Phase 7 can shape its own export.
- **`runTally` is idempotent.** Re-running with the same ballots produces the same results (modulo `created_at`). The action does `delete from tally_results where run_num between 1 and 5` then re-inserts inside the function's transaction.

## Migration count

16 (was 13 after Phase 5; +3 for `0014_admin_functions.sql`, `0015_submit_ballot_polls_gate.sql`, `0016_fix_tally_delete_clause.sql`).
