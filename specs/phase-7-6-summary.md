# Phase 7.6 Summary — Sandbox Review Cleanup

Six items from Francis's first-pass sandbox review. Five small UI/copy + one bug + one moderate feature change. One new migration (`0017`), no new top-level dependencies. Six commits.

## What shipped

### Email copy across auth screens (Commit 1, `4446e19`)

The validation regex in `lib/actions/auth.ts` was already domain-agnostic; only the UI implied a school-email constraint. Brought into line.

- `app/register/page.tsx` — "School email" label → "Email", placeholder → `niccolo@machiavelli.com`, dropped the `@sanbeda.edu.ph` hint.
- `app/signin/form.tsx` — same label / placeholder swap, "We'll send a one-time link to your school email" → "your email".
- `app/awaiting-email/page.tsx` — "school inbox" → "inbox".
- `app/(authed)/profile/profile-form.tsx` — "School email" → "Email".

`grep -rn "school email|school inbox|@sanbeda\.edu\.ph|you@sanbeda" app/ components/` returns zero.

### Admin > Voters: assigned topic + ballot status now render (Commit 2, `6e5f5f7`)

**Root cause:** PostgREST flips between object and one-element array shape for FK embeds depending on version + query shape. Both `profiles → topics (UNIQUE presenter_voter_id)` and `profiles → ballots (UNIQUE voter_id)` are conceptually one-to-one but arrived at the helper as objects, while the code typed and accessed them as arrays via `?.[0]`. Result: every voter showed "no topic" / "—" regardless of actual state.

**Fix:** new `unwrapEmbed<T>(value: T | T[] | null | undefined): T | null` generic at the top of `lib/data/admin.ts`. Both embeds typed defensively as `T | T[] | null`. Replaced the two `?.[0]` access sites in `getAllVoters` with `unwrapEmbed()`.

**Audit:** `grep '?.\[0\]\|?\[0\]' lib/data/ lib/actions/` confirmed only `lib/data/admin.ts` had the bug. Other helpers (`getAllTopics`, `getMyTopic`, `getResults`, `getResultsTopicMap`) embed in the topics → profiles direction and already typed the embed as object.

### Note-editor share gate (Commit 3, `7879a0e`)

Three changes prevent empty/whitespace shared notes from surfacing as blank cards on every classmate's "Class notes" tab:

- `components/note-editor.tsx` — `Switch` is `disabled` when `body.trim() === ""` AND the note is currently private. A muted "Write something to share." sub-label appears beside the disabled switch. The lock icon + "Private" label stay.
- `lib/actions/notes.ts` — `setNoteVisibility` looks up the existing note's body before flipping to `class`. If empty/whitespace, returns `"Write a note before sharing it with the class."` Defensive backstop — the client gate prevents most cases, but a direct action call (e.g. via a stale form replay) could still try.
- `lib/data/notes.ts` — `getClassNotes` filters `body.trim() === ""` rows post-fetch. Catches any historical empty class notes from before the gate landed.

Empty bodies are still allowed via `upsertNote` (a user clearing a note); only sharing them is blocked.

### Landing footer credit + GitHub source link (Commit 4, `6f5197e`)

- `next.config.ts` exposes `NEXT_PUBLIC_COMMIT_SHA` at build time. Vercel sets `VERCEL_GIT_COMMIT_SHA` automatically; locally it shells out to `git rev-parse HEAD`; non-git build contexts fall back to `"dev"`.
- `.env.example` adds `NEXT_PUBLIC_REPO_URL=https://github.com/FrancisPlaza/agora`. `specs/deploy.md`'s env-var table picks it up. Empty value renders the SHA without an outbound link (local dev default).
- `app/page.tsx` rewrites the footer:
  - Left: `Built with ❤️ by Francis Plaza.` (real heart emoji)
  - Right: `Source on GitHub · agora@<7-char-sha>` — both halves link when the repo URL is set, or just `agora@<sha>` plain when not. The "Source on GitHub" half links to the repo home; the `agora@<sha>` half links to `${repo}/commit/${sha}`.

The "Beadles: Lim, Cruz" line never landed in this codebase (already removed pre-Phase 5 per `design-corrections.md`'s polish list), so nothing additional to drop.

### Allow pre-presented uploads (Commit 5, `56367c4`)

The chunky one. Migration + storage policy + data-layer mask + upload gate + banner sub-states.

#### Migration `0017_allow_pre_presented_upload.sql`

- Drops `topics.published_requires_presented` CHECK. The other two CHECKs stay (`presented_requires_presenter`, `published_requires_all_art`).
- `presentations_presenter_write` policy: drops the `presented_at` gate. Assigned presenters can write to their topic prefix.
- `presentations_read` policy: now `is_approved() AND (presented_at IS NOT NULL OR presenter = caller)`. Non-presenter approved voters get a 403 trying to `select` storage objects under a not-yet-presented topic.
- `specs/schema.md` updated to reflect both changes.

#### Data-layer mask

`maskArtForViewer(topic, viewerId)` in `lib/data/topics.ts` and `lib/data/results.ts`. When a topic isn't presented AND the viewer isn't the presenter, the four art fields (`art_title`, `art_explanation`, `art_image_path`, `art_uploaded_at`) all null out for that viewer. State derivation runs on the masked row → non-presenter viewers see `state="assigned"` for an art-uploaded-but-not-yet-presented topic, the same view they had pre-upload.

- `getAllTopics` and `getTopic` apply the mask. One `auth.getUser()` call each, parallel with the existing topic + count fetches.
- `getResults` and `getResultsTopicMap` apply the same mask to winners and to the timeline topic map. Defensive — if a tally runs before everyone is marked presented, a winner card renders with the placeholder rather than leaking the art prematurely.
- `getMyTopic` skips the mask. Presenter sees their own row truthfully — the dashboard banner needs the unmasked `art_uploaded_at` to decide which sub-state to render.

#### Upload page (`app/(authed)/topic/[id]/upload/page.tsx`)

Gate loosens: `topic.state === "unassigned"` still bounces; `assigned`, `presented`, `published` all proceed. Three header + submit-button copy variants:

| State | Header | Sub-line | Submit button |
|---|---|---|---|
| assigned, no upload yet | Upload your presentation | — | Save (visible after beadle marks presented) |
| assigned, art uploaded | Edit your presentation | _Visible to the class once your beadle marks you presented._ | Update |
| presented or published | Edit your presentation / Upload your presentation | — | Update / Save and publish |

`UploadForm` gains an optional `submitLabel` prop. Default behaviour is unchanged when no label is passed.

#### Server action

`lib/actions/presentation.ts` drops the `if (!topic.presented_at)` guard. The presenter-match check stays. Storage RLS now permits the write for assigned topics; the read policy hides it until presented.

#### Dashboard banner

`pickBanner` in `app/(authed)/dashboard/page.tsx` gains two new violet sub-cases at priority 2 and 3, slotting just below the amber 'presented' variant:

- **Priority 2** — `state="assigned"` AND no upload yet: "You're presenting [Philosopher]." / "You can upload your art early — it'll appear in the gallery once your beadle marks you presented." CTA: Upload now.
- **Priority 3** — `state="assigned"` AND uploaded ahead: "Your art is ready." / "It'll appear in the gallery once your beadle marks you presented." CTA: Edit upload.

Banner precedence in JSDoc updated. The amber-presenter variant still wins over polls-related variants; the two new violet sub-cases are softer.

#### Re-assignment cascade

The existing `assign_topic` Postgres function (Phase 6) clears art fields on reassignment, and the `assignTopic` server action does the storage cleanup. Verified still works after 0017 — no schema or policy change touches that path.

## Deviations from the brief

None. All six items land as scoped.

One minor judgement call: when `NEXT_PUBLIC_REPO_URL` is empty, the footer renders `agora@<sha>` as plain text rather than a dead link. Brief gave both options; plain text felt cleaner for local dev.

## Migration count

**17.** `supabase db reset` runs cleanly through `0001` → `0017`.

## New env vars to set in Vercel before deploy

- **`NEXT_PUBLIC_REPO_URL`** — `https://github.com/FrancisPlaza/agora`. Empty value is supported (footer omits the link); set it on the sandbox so the source link renders.
- **`NEXT_PUBLIC_COMMIT_SHA`** is wired automatically: `next.config.ts` reads `VERCEL_GIT_COMMIT_SHA` (which Vercel sets) and re-exports it as `NEXT_PUBLIC_COMMIT_SHA`. **No manual config needed in Vercel.**

The existing env vars (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_BEADLE_CONTACT`) carry over.

## Verification

- `npm run lint` — clean.
- `npm run typecheck` — clean.
- `npm run build` — clean (Next 16 + Turbopack, all routes typed).
- `npm run test` — 34/34 (`validation` 17, `irv` 10, `voting` 7).
- `supabase db reset` — 17 migrations apply in order, no errors.

Manual browser verification not done in this commit (deferred to next sandbox push); the changes' risk surfaces are the storage RLS and the dashboard banner, both of which are exercised by the existing seed flow.

## Outstanding (production review pass)

- **HEIC upload smoke test against a real iPhone capture.** Phase 7.5's placeholder path is unit-tested; the actual upload-then-render-after-publish flow needs an iPhone-shot HEIC. Not a blocker — storage path is the same as JPG/PNG.
- **Cross-browser print rendering for `/results`.** Phase 7 verified Chrome only. Safari and Firefox print engines may differ on `print-color-adjust`. Worth a manual check before the production print is used to tape results to the classroom door.
- **Email-template customisation.** Supabase defaults still in place. Brand the magic-link / confirmation email before the production deploy.
- **Real beadle contacts in `NEXT_PUBLIC_BEADLE_CONTACT`.** Sandbox carries the placeholder; production should hold real Beadle Lim / Beadle Cruz contact lines.
- **`getMyTopic` and the masked banner.** The banner reads the unmasked `art_uploaded_at` from `getMyTopic` (which is correct — presenter sees their own row truthfully). One subtlety: if the dashboard ever renders for a non-presenter who shares the same UI, the banner code would silently fall through to non-presenter variants because `myTopic` would be `null`. That's by design but worth flagging to anyone who later wires a "view-as" admin flow.

## Files touched

```
NEW   supabase/migrations/0017_allow_pre_presented_upload.sql
NEW   specs/phase-7-6-summary.md  (this file)

MOD   app/register/page.tsx
MOD   app/signin/form.tsx
MOD   app/awaiting-email/page.tsx
MOD   app/(authed)/profile/profile-form.tsx
MOD   app/page.tsx                 (Built-with-❤️ + Provenance footer)
MOD   app/(authed)/dashboard/page.tsx  (banner sub-states)
MOD   app/(authed)/topic/[id]/upload/page.tsx  (widened gate + 3 copy variants)

MOD   components/note-editor.tsx   (disabled switch + sub-label)
MOD   components/upload-form.tsx   (submitLabel prop)

MOD   lib/data/admin.ts            (unwrapEmbed)
MOD   lib/data/notes.ts            (empty class-note filter)
MOD   lib/data/topics.ts           (maskArtForViewer)
MOD   lib/data/results.ts          (maskArtForViewer)
MOD   lib/actions/notes.ts         (setNoteVisibility body check)
MOD   lib/actions/presentation.ts  (dropped presented_at guard)

MOD   next.config.ts               (commit-SHA wiring)
MOD   .env.example                 (NEXT_PUBLIC_REPO_URL)
MOD   specs/schema.md              (constraint + storage policy update)
MOD   specs/deploy.md              (NEXT_PUBLIC_REPO_URL env var row)
```

Six commits total.
