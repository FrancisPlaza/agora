# Phase 3 Summary — Voter Dashboard and Topic Detail

The dashboard becomes the class gallery — 32 topic cards in their four lifecycle states, with URL-driven filter chips and a status banner. Topic detail renders the artwork (or a tinted placeholder), the philosopher's explanation, and the notes section: editable private note with debounced autosave, visibility switch to share with class, and a server-rendered class-notes tab.

End-to-end verified in a real browser against local Supabase + Mailpit.

## What shipped

### UI primitive extensions (`components/ui/`)

- `badge.tsx` — six tones (neutral / violet / amber / success / danger / navy).
- `chips.tsx` — URL-driven filter chip group; active chip = filled with shadow.
- `tabs.tsx` — URL-driven tab strip with optional counts; active tab = violet underline.
- `switch.tsx` — animated toggle, used for note visibility.
- `status-banner.tsx` — three tones with optional trailing action slot.

Chips and tabs intentionally drive their state through `?filter=…` / `?tab=…` so the page itself stays a server component. No client-side fetching for any topics or notes data.

### Data-access helpers (`lib/data/`)

- `topics.ts` — `getAllTopics`, `getTopic(id)`, `getMyTopic`. State (`unassigned | assigned | presented | published`) is derived from which fields are populated, not stored. Presenter info embedded via the `topics_presenter_voter_id_fkey` FK; class-note count merged in from a single aggregate query rather than per-topic round trips.
- `notes.ts` — `getMyNote(topicId)`, `getClassNotes(topicId)` (joined to author profile, sorted `updated_at desc`), `getMyNotedTopics()` for the "My notes" filter.
- `storage.ts` — `getTopicArtUrl(path, { w, h })` returns a 1-hour signed URL with optional thumbnail transform.

All read helpers wrap in React 19's `cache()` so the dashboard's three calls (`getAllTopics` + `getMyTopic` + `getMyNotedTopics`) dedup any overlapping work within a single request.

### Server actions (`lib/actions/notes.ts`)

- `upsertNote({ topicId, body })` — body-only payload; visibility is intentionally omitted so on update it stays unchanged. RLS (`notes_self_write`) gates authorisation; no service-role.
- `setNoteVisibility({ topicId, visibility })` — visibility-only payload; body is omitted so the existing body is preserved on flip. On insert it falls back to the column default (empty string), matching the brief's "create empty-body note with chosen visibility if none exists yet."

### Components

- `topic-card.tsx` — server. Four-state hero, amber "Yours" pill on the current user's topic, footer meta (presenter / scheduled date / presented date / class-note count badge). Uses `philosopher / theme` per design correction #5.
- `art-placeholder.tsx` — server. Deterministic tinted SVG keyed off `order_num`; 12-tint palette transcribed from `src/data.jsx`'s `TINTS`.
- `note-editor.tsx` — client. Debounced autosave (1.8s) plus on-blur flush; optimistic visibility switch with revert on error; three-state indicator.

### Pages

- `app/(authed)/dashboard/page.tsx` — replaces Phase 2 stub. Status banner with two variants (presenter-amber if my topic is in `presented` state, neutral informational otherwise). Five filter chips with counts. 3-col desktop / 2-col tablet / 1-col mobile.
- `app/(authed)/topic/[id]/page.tsx` — server. URL-driven tabs (`?tab=class`); 404 via `notFound()` for invalid ids. Sticky bottom-right CTA targets `/vote` (Phase 4 placeholder — see below).
- `app/(authed)/topic/[id]/class-notes.tsx` — server. Empty state, otherwise a list of cards with author avatar / name / relative timestamp / serif body.

### Helper

- `lib/relative-time.ts` — formats note timestamps as `just now` / `Nm ago` / `Nh ago` / `yesterday` / `3 May` / `3 May 2025`. No new dependencies.

## Deviations from the brief

1. **One new migration despite the brief saying none would be needed.** Phase 1's `is_approved()` and `is_admin()` helpers in `0003_helpers.sql` query the `profiles` table to check the caller's status, but with RLS on, that inner SELECT triggers the same `profiles_approved_read_others` policy that called the helper — infinite recursion (SQLSTATE 54001, "stack depth limit exceeded"). Phase 2 never tripped it because the only profile read was self via `profiles_self_read` (id = auth.uid()), which doesn't go through the helpers. Phase 3's `topics → profiles` FK embed hits the recursive path the moment any approved voter loads the dashboard. Migration `0012_fix_helper_recursion.sql` marks both helpers `security definer` so the inner query bypasses RLS, with explicit `search_path` per the convention added in Phase 2's `0011`. **Migration count is now 12.**

2. **Sticky CTA points to `/vote`.** Brief says "the Phase 5 placeholder for now" for the presenter-banner CTA, and "the Phase 2 placeholder" (`/vote`) for the topic-detail "Add to my ranking" CTA. I used `/profile` for the presenter banner (closest to where Phase 5's upload UI will land) and `/vote` for the ranking CTA. Both are flagged below for repointing.

3. **No client-side data fetching anywhere.** Per the brief. Filter and tab state both live in URL search params, the dashboard server component reads them, and the page re-renders. Note editor is the only client component touching data, and it does so through server actions, not direct Supabase calls.

## Manual SQL flips for testing

Phase 6's beadle UI isn't built. To exercise Phase 3 you'll need to advance topics through the four states by hand, plus seed at least one second user for class-notes testing.

```sql
-- Reset a topic
update public.topics
   set presenter_voter_id = null,
       presented_at = null,
       art_title = null,
       art_explanation = null,
       art_image_path = null,
       art_uploaded_at = null
 where id = 1;

-- Assigned (CHECK constraint requires presenter_voter_id before presented_at)
update public.topics
   set presenter_voter_id = (select id from public.profiles where email = 'voter@sanbeda.edu.ph'),
       scheduled_for = now() + interval '7 days'
 where id = 1;

-- Presented (after assigned)
update public.topics
   set presented_at = now() - interval '2 days'
 where id = 1;

-- Published (after presented; all three art_* fields required)
update public.topics
   set art_title = 'Customary Bedrock',
       art_explanation = 'Hume approaches the question of law not as a set of commands but as a structure of reasons...',
       art_image_path = '1/test-placeholder.png',
       art_uploaded_at = now()
 where id = 1;
```

For class notes, seed a second user via the SDK (the REST `/auth/v1/otp` endpoint also works but doesn't honour `redirect_to`), approve them, then either insert a note row directly:

```sql
insert into public.notes (voter_id, topic_id, body, visibility)
values (
  (select id from public.profiles where email = 'classmate@sanbeda.edu.ph'),
  4,
  'The pure theory is cleaner than Hart''s rule of recognition...',
  'class'
);
```

…or sign in as that user in a second browser, navigate to the topic, write a note, flip the switch.

## What Phase 4 (ranking) needs to know

- **Reuse the `TopicView` shape from `lib/data/topics.ts`.** The ranking thumbnails want the same `philosopher / theme` plus the placeholder fallback. The `TopicCard` is too heavy for the ranking row, but `ArtPlaceholder` and `getTopicArtUrl` are fit-for-purpose — pull them in directly.
- **`getMyTopic()` exists** on `lib/data/topics.ts` for the "your topic" pill / self-vote affordance. It reads via the user-scoped client and respects the same RLS the dashboard does.
- **The "Add to my ranking" CTA on `app/(authed)/topic/[id]/page.tsx` currently links to `/vote`.** Phase 4 should repoint it to whatever the actual ranking flow URL is — likely still `/vote`, but with the right anchor or query param to scroll to / pre-add the topic.
- **The presenter-status banner on the dashboard targets `/profile`** for the "Upload now" action. Phase 5 should repoint to wherever the upload flow lands.
- **Server actions and revalidation.** `upsertNote` and `setNoteVisibility` both call `revalidatePath('/topic/<id>')` and `revalidatePath('/dashboard')`. If Phase 4 mutates topics or rankings from a server action, follow the same convention so the dashboard's note-count badges and the "My notes" chip stay current after a write.
- **No new dependencies.** Phase 3 ships zero. The `@dnd-kit` packages CLAUDE.md mentions for Phase 4 are still un-installed; flag before adding.

## Acceptance criteria

- [x] `npm run lint`, `npm run typecheck`, `npm run build`, `npm run test` — all pass.
- [x] `supabase db reset` works; one new migration (0012), see Deviations.
- [x] `/dashboard` renders all 32 topics. With unmodified seed data, every card is `unassigned` (no presenters assigned).
- [x] After flipping a topic to `assigned` / `presented` / `published` via SQL, the card re-renders accordingly.
- [x] `/topic/[id]` renders for any valid id; 404 for invalid (`notFound()` from `next/navigation`).
- [x] Note editor saves on blur and on debounce. Visibility switch persists immediately and the optimistic flip reverts if the action fails.
- [x] Class-notes tab shows the note from a second user with `visibility = 'class'`. The current user's own shared note also appears (the algorithm doesn't special-case self).
- [x] Topic cards display `philosopher / theme`. No reference to `work` in production code.
- [x] Amber "Yours" pill appears on the current user's assigned topic across all four states.
- [x] No client-side data fetches anywhere — only the note editor's server-action calls.

## Migration count

12 (was 11 after Phase 2; +1 for `0012_fix_helper_recursion.sql`).
