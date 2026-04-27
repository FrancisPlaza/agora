# Phase 4 Summary — Ranking and Ballot Submission

The cornerstone interaction. `/vote` renders the drag-to-rank editor for an approved voter when polls are open, with autosave, sticky bottom bar, and a submit modal. The page also has read-only states for "polls not open", "ballot submitted", and "polls closed". The dashboard's status banner picks up the new states on top of Phase 3's presenter-amber variant.

End-to-end verified in a real browser against local Supabase + Mailpit.

## What shipped

### New migration

- `supabase/migrations/0013_draft_function.sql` — `save_draft_rankings(p_rankings jsonb)`. Sibling to `submit_ballot` from Phase 1.5 with three differences: (a) does not set `submitted_at`, (b) accepts an empty array (clears all rankings without deleting the ballot row), (c) does not write `audit_log`. Same auth / eligibility / validation / FOR UPDATE pattern, same discrete error codes (`NOT_AUTHENTICATED`, `NOT_ELIGIBLE`, `INVALID_RANKINGS`, `DUPLICATE_RANK`, `DUPLICATE_TOPIC`, `INVALID_TOPIC`, `BALLOT_LOCKED`).

### Server actions (`lib/actions/ballot.ts` extension)

- `saveDraftRankings(rankings)` — thin wrapper around the new RPC. Same `as never` cast as `submitBallot` for the supabase-js generic mismatch.
- `addToMyRanking(topicId)` — convenience for the topic-detail CTA. Reads the user's current ballot, no-ops on duplicate, otherwise appends at rank N+1, saves, and `redirect('/vote?focus=<id>')`. Returns `BALLOT_LOCKED` for the caller to surface inline.

### Data helpers (`lib/data/voting.ts`)

- `getVotingState()` — singleton `voting_state` row.
- `getMyBallot()` — current user's ballot + rankings (ascending by rank). `null` if no ballot exists.
- `derivePollsState({ deadline_at, polls_open_at, polls_locked }, now)` — pure: `closed > not_open > open`. `polls_locked` short-circuits, deadline-equals-now is `closed`.
- `lib/data/voting.test.ts` — 7 boundary cases.

### Components

- `components/ranking-thumbnail.tsx` — server. Square art tile with retina-resolution thumbnail transform (signed URL) for published topics; `ArtPlaceholder` fallback. Per design correction #2 — no single-letter affordances anywhere.
- `components/ranking-editor.tsx` — client. The single substantive client component. `@dnd-kit` with `PointerSensor` + `TouchSensor` (5px activation) + `KeyboardSensor`; right pane is a `SortableContext` + a `useDroppable` target; drag-from-left adds, drag-within-right reorders, remove button pulls back to unranked. Drag listeners attach to the drag handle only — putting them on the row swallows clicks on the Add / Remove buttons. Autosave: 800ms debounce, optimistic state update with revert-on-error, three-state indicator. Submit modal with the prototype's copy and a muted-neutral lock warning (per design correction).

### Pages

- `app/(authed)/vote/page.tsx` — replaces Phase 2 stub. Server component. Pre-renders thumbnails into a `Map<number, ReactNode>` and passes them to the client editor — keeps signed-URL generation server-only. Eligibility gate: approved AND assigned topic; non-voters bounce to `/dashboard`. Four rendered states from `polls + submitted` derivation.
- `app/(authed)/topic/[id]/page.tsx` — sticky CTA repointed from `<Link href="/vote">` to `<AddToRankingForm>` calling `addToMyRanking`.
- `app/(authed)/topic/[id]/add-to-ranking-form.tsx` — small client wrapper using `useActionState` so `BALLOT_LOCKED` errors surface inline.
- `app/(authed)/dashboard/page.tsx` — banner state-machine updated. Four variants in priority order: presenter-amber (own topic in `presented`) → polls-closed amber → submitted neutral → voting-open violet → fallback take-notes violet.

### Dependencies

Added three packages: `@dnd-kit/core@^6.3.1`, `@dnd-kit/sortable@^10.0.0`, `@dnd-kit/utilities@^3.2.2`. The first two are explicitly called out in `CLAUDE.md` and design correction #3; `utilities` is the peer that exposes `CSS.Translate.toString()` used by sortable items.

## Deviations from the brief

1. **Three `@dnd-kit` packages, not two.** Brief lists `@dnd-kit/core` + `@dnd-kit/sortable`. `@dnd-kit/utilities` is required as a peer for the `CSS.Translate.toString()` helper that sortable items use to render their drag transforms. No surprises in install — all three React 19 compatible at the versions chosen.

2. **Drag listeners on the handle only, not the whole row.** The brief implied row-level draggability. Putting `{...listeners}` on the row swallowed clicks on the Add / Remove buttons (PointerSensor consumes the pointerdown). Both `RankedRow` and `UnrankedRow` now attach listeners to the drag-handle button only. The handle is sized + cursor-styled like the prototype's affordance, so drag is still discoverable.

3. **No `unlock_ballot` server action.** Brief notes this is Phase 6. Verification used the documented SQL stand-in (`update ballots set submitted_at=null, locked_at=null where voter_id=...`).

## Manual SQL flips for testing

Run inside the local Supabase Postgres (`docker exec supabase_db_agora psql -U postgres`):

```sql
-- Open polls now, deadline 7 days out
update public.voting_state
   set polls_open_at = now(),
       deadline_at = now() + interval '7 days',
       polls_locked = false
 where id = 1;

-- Close polls (Phase 6's lock_ballots() will replace this)
update public.voting_state
   set polls_locked = true,
       polls_locked_at = now()
 where id = 1;

-- Reset to "not yet open"
update public.voting_state
   set polls_open_at = null,
       deadline_at = null,
       polls_locked = false,
       polls_locked_at = null
 where id = 1;

-- Unlock a submitted ballot for the test voter (the SQL stand-in for
-- Phase 6's unlock_ballot(target_voter_id))
update public.ballots
   set submitted_at = null,
       locked_at = null
 where voter_id = (select id from public.profiles where email = 'voter@sanbeda.edu.ph');

-- Inspect current state
select * from public.voting_state;
select b.voter_id, p.email, b.submitted_at, b.locked_at,
       (select count(*) from public.rankings r where r.ballot_id = b.id) as ranks
  from public.ballots b
  join public.profiles p on p.id = b.voter_id;
```

For multi-user testing, register a second account via the SDK pattern from the Phase 2 / 3 summaries, manually flip them to `approved` with a topic assignment, then exercise the editor from a second browser session.

## Acceptance criteria

- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` — all pass (17 tests now, +7 for `derivePollsState`).
- [x] `supabase db reset` works; one new migration (`0013`).
- [x] `save_draft_rankings` visible via `\df` in psql; grant in place.
- [x] Default `voting_state` → `/vote` renders the "polls not open" view.
- [x] After SQL-flipping `polls_open_at = now()`, `/vote` lets the user drag and add topics into the ranking pane.
- [x] Drag-to-rank works on mouse (desktop). Touch verified by sensor configuration; drive-via-touch wasn't exercised in headless QA.
- [x] Autosave fires within ~1s of an Add. Indicator transitions through "Saving…" → "Draft saved · just now". DB rows reflect the saved order.
- [x] Submit modal opens, "Submit ballot" calls `submitBallot`, page re-renders in read-only locked state with neutral banner.
- [x] SQL-flipping `submitted_at = null` restores editability on next render.
- [x] SQL-flipping `polls_locked = true` renders the closed-state banner on both `/vote` and `/dashboard`.
- [x] Dashboard banner switches between Phase 3 variants and Phase 4 variants based on voting + ballot state. Verified each variant in the browser.
- [x] Clicking "Add to my ranking" from `/topic/<id>` lands the user on `/vote?focus=<id>` with that topic ranked at the bottom of their list.
- [x] No client-side data fetching anywhere except the editor's autosave server-action calls.
- [x] Ranking rows use real artwork thumbnails (placeholder fallback for unpublished), not single-letter affordances.

## What Phase 5 (presenter upload) needs to know

- **The dashboard's presenter-amber banner currently links to `/profile`.** Phase 5's upload flow should land at a dedicated route (perhaps `/profile/upload` or `/topic/<id>/upload`); repoint the CTA's `<Link href>` once that exists.
- **`getMyTopic()` already returns the topic in its current state.** Phase 5's upload UI can read `myTopic.state === 'presented'` to gate visibility.
- **Storage bucket and RLS are in place** (`presentations`, path `{topic_id}/{filename}`, presenter-write only when topic is `presented`). `getTopicArtUrl` from `lib/data/storage.ts` is the read path; Phase 5 needs the write side.

## What Phase 6 (admin views) needs to know

The following actions are placeholders today, exercised via SQL. Phase 6 should provide admin-server-action counterparts:

- `openPolls()` / `setDeadline(at)` — set `voting_state.polls_open_at` / `deadline_at`. Audit log.
- `lockBallots()` — flips `voting_state.polls_locked = true`, sets `polls_locked_at`, sets `locked_at` on every unsubmitted ballot. Audit log.
- `unlockBallot(targetVoterId)` — clears `submitted_at` and `locked_at` on a single ballot. Existing rankings preserved. Audit log.
- `runTally()` — already exists in Phase 1.5 (`lib/actions/tally.ts`). Admin UI just needs a button that calls it.

Notes for the admin UX:

- Admins still cannot read individual `rankings` (RLS deliberately denies). Admin views should query through the `ballots` table for status only — never `rankings`.
- The dashboard's banner state-machine is the single source of truth for what voters see during these transitions; admin actions should `revalidatePath('/dashboard')` and `revalidatePath('/vote')` so the cards / banners refresh.

## TOCTOU note on `addToMyRanking`

Between the action's read of the ballot and its write, another tab could save a different draft, so the just-added topic could end up duplicated or with a stale rank. Acceptable for Phase 4 — users almost never have two tabs open ranking simultaneously. The action does dedup the topic locally before sending, so the worst case is an idempotent no-op rather than a corrupted ballot. If this becomes an issue, the cleanest fix is a Postgres function that takes `(p_topic_id, p_position)` and does the read + append + dedup atomically inside the same FOR UPDATE block as `save_draft_rankings`.

## Migration count

13 (was 12 after Phase 3; +1 for `0013_draft_function.sql`).
