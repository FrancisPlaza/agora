# Phase 5 Summary — Presenter Upload Flow

A presenter whose topic is in `presented` state lands on `/topic/[id]/upload`, picks a file (image or PDF), enters a title and 5–7 sentence explanation, and clicks "Save and publish". The action uploads to Supabase Storage at the deterministic path `{topicId}/artwork.{ext}` (plus a `.preview.png` sibling for PDFs, rendered client-side), updates the topic row, and the topic transitions to `published`. Edit mode pre-populates the form; the file is optional. Dashboard amber CTA repointed to the topic-specific upload route.

End-to-end verified in a real browser against local Supabase + Mailpit, including gating, upload round-trip, edit-without-file, dashboard re-render, and the banner repoint.

## What shipped

### Validation helpers (`lib/validation.ts`)

- `countSentences(text)` — terminal-punctuation regex; documented as a soft guide (won't perfectly handle "Mr." / "e.g."). Same algorithm runs on the form and in the action so behaviour stays consistent.
- `isAcceptedArtFile({type, name, size})` — JPG / PNG / WEBP / HEIC / PDF, ≤ 10 MB. Both MIME and extension checked because iOS Safari reports HEIC inconsistently (`image/heic`, `image/heif`, sometimes empty).
- `isPdf`, `fileExtensionForStorage` helpers.
- `lib/validation.test.ts` — 13 cases.

### Storage helper extension (`lib/data/storage.ts`)

- `getThumbnailPath(path)` — resolves `<id>/artwork.pdf` to its `<id>/artwork.pdf.preview.png` sibling; pass-through for images.
- `getTopicArtUrl(path, opts)` now calls `getThumbnailPath` before signing. Every dashboard / ranking / topic-detail thumbnail Just Works for both file kinds; no caller changes.
- `getTopicOriginalUrl(path)` — signed URL for the *original* file (PDF or image), bypassing thumbnail resolution. Not surfaced in Phase 5 UI; held for a future "View original PDF" affordance.

### Server action (`lib/actions/presentation.ts`)

`uploadPresentation(formData)` — single action handles both first-publish and metadata-only edits. FormData shape:

| key             | type    | required               |
|-----------------|---------|------------------------|
| `topicId`       | number-as-string | always       |
| `artTitle`      | string  | always                 |
| `artExplanation`| string  | always                 |
| `file`          | File    | required first publish; optional in edit |
| `pdfPreview`    | Blob    | required iff `file` is a PDF |

Auth + presenter-match + state checks happen up front for friendly errors. RLS on `topics_presenter_update_art` plus the `presentations` storage policies enforce the same rules at the DB boundary regardless. Storage write path: `list` + `remove` everything under `{topicId}/` first so a PDF→image swap doesn't leave a stale `.preview.png` behind, then upload the new file (and the PNG preview if PDF). On success: `revalidatePath` dashboard + topic detail + this page, then `redirect('/dashboard')` — no `window.location.assign`.

### Upload form (`components/upload-form.tsx`)

Client component. Drag-drop zone with hover state, click-to-browse, validation-on-pick. Image picks render via `URL.createObjectURL`. PDF picks dynamic-import `pdfjs-dist`, render the first page to an offscreen canvas at 600px wide, export PNG `Blob`, hold in state, ship to the action as `pdfPreview`. Worker resolved via `new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url)` (Turbopack-compatible). Live sentence-count badge (success / amber / neutral). Submit through `useActionState` for inline error surface.

### Faux preview (`components/upload-preview.tsx`)

Server-style component that mimics the published-state `TopicCard` layout. Separate from the real card because the real card expects a fully resolved `TopicView` and we'd be jamming partial in-progress data into it.

### Page (`app/(authed)/topic/[id]/upload/page.tsx`)

Server component. Gates: 404 if topic missing; redirect to `/dashboard` if caller isn't the presenter, or if state is `unassigned`/`assigned`. Edit mode pre-loads the existing thumbnail signed URL for the in-form preview. Header copy switches between "Upload your presentation" / "Edit your presentation".

### Repointing

- **Dashboard amber banner** (`app/(authed)/dashboard/page.tsx`). `pickBanner()`'s presenter-amber branch now links to `/topic/${myTopicId}/upload`. `BannerProps` gained a `myTopicId` field.
- **Profile page** (`app/(authed)/profile/page.tsx`). Replaced the Phase 2 placeholder line with a real assigned-topic card: thumbnail (signed URL or placeholder) + topic name + theme + state-aware action — "Upload art" button when `presented`, "Published" badge + "Edit" button when `published`, scheduled-date badge when `assigned`.
- **Topic detail** (`app/(authed)/topic/[id]/page.tsx`). When the current user is the presenter and the topic is `presented` or `published`, a "Your topic" badge + "Upload art" / "Edit upload" button appears in the meta row.

### Dependency

Added `pdfjs-dist@^5.6.205` as the only new top-level dep. Brief explicitly greenlights this. Dynamic-imported only when the user picks a PDF, so it never lands in the main bundle.

## Deviations from the brief

1. **No deviations.** Every brief item shipped as specified. Migration count is unchanged at 13. Single action handles both create and edit (per the brief's offered consolidation). Profile assigned-topic block was added (brief left it as "if it exists"; the Phase 2 placeholder was clearly meant to be replaced here). Topic-detail "Your topic" action was added (brief called it optional polish; it's two lines and matches the prototype's affordance pattern).

## Manual SQL flips for testing

Run inside the local Supabase Postgres (`docker exec supabase_db_agora psql -U postgres`):

```sql
-- Set the test voter as topic 1's presenter, then advance through states.
update public.topics
   set presenter_voter_id = (select id from public.profiles where email = 'voter@sanbeda.edu.ph'),
       presented_at = now()
 where id = 1;
-- (combined: the CHECK constraint requires presenter_voter_id NOT NULL
--  before presented_at; do them in one statement.)

-- Reset back to unassigned (must be one statement: clear all art fields
-- before clearing presenter_voter_id, otherwise the published_requires_*
-- checks fire mid-transition.)
update public.topics
   set presenter_voter_id = null,
       presented_at = null,
       art_title = null,
       art_explanation = null,
       art_image_path = null,
       art_uploaded_at = null
 where id = 1;

-- Inspect storage for a topic
select name, metadata->>'size' as size, created_at
  from storage.objects
 where bucket_id = 'presentations'
   and name like '1/%';

-- Force a topic back to 'presented' (e.g. for re-testing the upload form)
update public.topics
   set art_title = null,
       art_explanation = null,
       art_image_path = null,
       art_uploaded_at = null
 where id = 5;
```

A quirk worth noting: when running multi-statement scripts via `psql -c '...'`, an error in one statement aborts the rest of the script (single-transaction mode by default in non-interactive use). Either run statements separately or chain them with `BEGIN; ... COMMIT;` if you need atomic-or-nothing.

## What Phase 6 (admin views) needs to know

- **`mark_topic_presented(topic_id)`** doesn't exist as an action yet — the beadle currently flips `presented_at` via SQL. Phase 5's gate logic depends on `presented_at` being non-null, so this is the natural Phase 6 trigger.
- **`assign_topic(target_voter_id, topic_id)`** likewise — used to assign or re-assign a topic to a presenter. The unique constraint on `topics.presenter_voter_id` means re-assignment requires clearing the old assignment first.
- **`lock_ballots()`, `unlock_ballot(target_voter_id)`, `set_deadline(at)`, `open_polls()`, `run_tally()`** — still SQL-flipped today. `run_tally()` already exists from Phase 1.5 (`lib/actions/tally.ts`); the rest are admin-action stubs to wire up.
- **Reassignment cascade.** If a beadle reassigns a topic that already has art, decide whether the storage objects should be wiped (yes is the safest default — a new presenter starts clean) or preserved. Phase 6 spec, not Phase 5's call.
- **Note on RLS:** admins still can't read individual `rankings`. Admin views should query `ballots` for status only, never `rankings`.

## What Phase 7 (results) needs to know

- **Image helper for results.** `getTopicArtUrl` already resolves PDFs to their preview transparently. Results page can use the same helper for the top-5 podium thumbnails — no new code.
- **`getTopicOriginalUrl`** is available if the results display wants a "View original PDF" link on the published top-5 entries.
- **Storage path convention** is `{topicId}/artwork.{ext}` plus `{topicId}/artwork.{ext}.preview.png` for PDFs. If results wants to embed the PDF inline (PDF.js viewer), use `getTopicOriginalUrl`.

## Acceptance criteria

- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` — all pass (30 tests).
- [x] `supabase db reset` works; **no new migrations** (count stays at 13).
- [x] After SQL-flipping a topic to `presented` for the current user, `/topic/[id]/upload` renders the form.
- [x] Non-presenter who navigates to the same URL is redirected to `/dashboard`.
- [x] Presenter for a topic in `unassigned`/`assigned` state is redirected to `/dashboard`.
- [x] Uploading a PNG: topic row gets all four art fields; file lands at `5/artwork.png` (155 B verified in storage).
- [ ] Uploading a PDF: two storage objects (PDF + `.preview.png`). Verified the form path and the `pdfjs-dist` worker resolution; not exercised in this run because creating a valid test PDF in headless was out of scope. Worth a manual smoke before shipping.
- [x] After upload the dashboard card flips to published with the artwork rendered as the hero.
- [x] Edit mode renders pre-populated; saving with no new file updates only the metadata (`art_image_path` unchanged in DB).
- [x] Sentence-count badge updates live; out-of-range doesn't block submit but server-side enforces the same range.
- [x] File-too-large / wrong-type uploads surface inline (validation tested via 13-case unit suite; runtime path uses the same predicate).
- [x] Dashboard amber CTA repointed to `/topic/${topicId}/upload` (verified via DOM `href` inspection).
- [x] No client-side data fetching anywhere — `pdfjs-dist` is local rendering, not a fetch.

## Migration count

13 (unchanged from Phase 4 — Phase 5 added zero migrations as required).
