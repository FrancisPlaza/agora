# Agora — Project Instructions

Ranked-choice voting and class gallery for JDN101 Philosophy of Law (San Beda College Alabang, A.Y. 2025-26). **Read this file at the start of every session.**

The user is **Francis Plaza**. He's reviewing your output as a senior engineer / product manager. His preferences are codified below — follow them.

---

## At the start of every session

Read these before any work:

- `specs/design-corrections.md` — five fixes from the design review; apply during build.
- `specs/schema.md` — Supabase tables, RLS policies, triggers, storage rules. Authoritative for Phase 1.
- `specs/irv-spec.md` — sequential IRV algorithm with deterministic tie-break rules and test fixtures. The tally must match these tests.
- `Agora.html` + `src/*.jsx` — the design prototype. **Read-only reference.** Visual system, palette, type, motion, and screen layouts are locked. Defer to it for visual decisions; don't reuse the JSX as production code.

---

## What we're building

A web app for a 32-student law school class. Each student presents one legal philosopher's thinking through:

- one piece of visual artwork (image or PDF), uploaded after they present
- a 5-7 sentence written explanation
- a 3-5 minute oral presentation in class

The class then ranks all 32 presentations using **sequential instant-runoff voting (IRV)** to identify the top 5. Voting is private — beadles (admin-flagged students) cannot see individual ballots.

Agora doubles as a class gallery: the dashboard fills in over the term as students present and upload, becoming a study aid for voting and beyond.

---

## Tech stack (locked — don't deviate without flagging)

- **Framework:** Next.js 15 (App Router, TypeScript strict)
- **Backend:** Supabase (Postgres + Auth + Storage + RLS)
- **Auth:** Supabase Auth, magic-link only — no passwords
- **Hosting:** Vercel
- **Styling:** Tailwind CSS, with design tokens transcribed from `src/styles.css`
- **Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable` (touch-capable, accessible)
- **Animations:** Framer Motion, used sparingly (ranking-row reorder, modal transitions)
- **Image handling:** Supabase Storage with built-in image transformations for thumbnails
- **PDF preview:** server-side first-page extraction (e.g. `pdf-lib` or `pdfjs-dist`) at upload time

---

## User roles

Voting eligibility rule: **if you are presenting, you are voting. Otherwise, you are not voting.**

- **Voter / Presenter** — an approved profile assigned to one of the 32 topics. Can vote, take notes, share notes. Derived: `status = 'approved' AND topics.presenter_voter_id = profiles.id`.
- **Beadle (student)** — a voter with `is_admin = true`. Has admin powers AND votes. Up to two supported.
- **Non-voting admin** — an approved profile with `is_admin = true` but no assigned topic. Used for the professor or other non-voting moderators. Full read access to gallery, notes, and results. Cannot create a ballot.
- **Observer** — `is_admin = false` and no assigned topic. Theoretical role; not used in v1 unless Francis approves a non-presenting student.

---

## Topic lifecycle

Each of 32 topics moves through four states. State is **derived** from which fields are populated; not stored as a column.

- **Unassigned** — no `presenter_voter_id`
- **Assigned** — `presenter_voter_id` is set, `presented_at` is null
- **Presented** — `presented_at` is set, `art_uploaded_at` is null
- **Published** — `art_uploaded_at` is set

Transitions are gated:

- Beadle can move from any state to `assigned` (assign or reassign), and from `assigned` to `presented`.
- Presenter moves from `presented` to `published` by uploading art, title, and explanation. Can edit forever after publishing.

One student → one topic; one topic → one student. Enforce via `UNIQUE` constraint on `presenter_voter_id`.

---

## Auth and approval flow

1. User registers (name, school email, student ID).
2. Supabase sends a magic-link email confirmation.
3. After confirmation, status is `pending_approval`. They land on a "Pending approval" screen and can't see class data.
4. Beadle reviews in the approval queue. Two approval paths:
   - **Approve as voter** — assign topic + approve. Required for student presenters.
   - **Approve as non-voting admin** — approve without topic, set `is_admin = true`. Used for the professor.
   They may also reject.
5. Once approved, the user has full read access to the gallery. Voters can additionally create a ballot.

Profile status enum: `pending_email`, `pending_approval`, `approved`, `rejected`.

---

## Voting flow

- Only voters (approved + assigned topic) can create a ballot. Non-voting users see the dashboard but no ranking page.
- Voters maintain a **draft ballot** anytime — drag topics into ranked order as presentations happen. Auto-save.
- **Final submission** opens after the beadle-set deadline OR when the beadle manually opens polls.
- Once submitted, the ballot is **locked** — read-only, no further edits.
- **Beadle can unlock a ballot for genuine errors** via `unlock_ballot(voter_id)`. Existing rankings are preserved; the voter edits and resubmits. Audit logged.
- Beadle can manually lock all ballots before the deadline (with confirmation modal).
- After lock, beadle triggers the tally. Top 5 winners via sequential IRV — see `specs/irv-spec.md`. Re-running the tally is supported and overwrites prior results.

Partial rankings are allowed. Unranked topics count as no preference (ballot exhausts when last preference is eliminated). Self-voting (a presenter ranking their own topic) is permitted.

---

## Ballot secrecy (critical)

Beadles must NOT be able to see individual rankings. They see only:

- Aggregate ballot status (X of Y submitted)
- Final tally results
- Voter list (registration status, approval status, ballot submission status — but not contents)

Enforce via RLS:

- Voters can `SELECT` only their own rows in `ballots` and `rankings`.
- Beadles can `SELECT` `ballots.voter_id` and `ballots.submitted_at` only — not `rankings`.
- The tally function runs as `service_role`, computes IRV server-side, and returns aggregates only. Never exposes individual ballots in any output.

This is a trust property of the system. Two beadles who are also voters need to know architecturally they can't peek.

---

## Notes

- One note per voter per topic.
- Notes are private by default. A `visibility` field flips between `private` and `class`.
- Class-shared notes are visible to all approved voters with author attribution and timestamp.
- Notes are editable forever — including after the term ends. No locking on notes.
- Notes can be written before, during, or after the topic is presented.

---

## File handling

- Artwork goes to Supabase Storage bucket `presentations`, path `{topic_id}/{filename}`.
- Accepted: JPG, PNG, GIF, WEBP, PDF. Max 10 MB.
- For PDFs, extract the first page at upload time and store as `{topic_id}/{filename}.preview.png` for fast thumbnail rendering.
- Bucket policies: `INSERT` allowed only to the matching presenter (RLS via path), `SELECT` for all approved voters, `UPDATE` not allowed (replace = delete + re-insert).

---

## Brand and design system

Visuals come from `Agora.html` and `src/styles.css`. Transcribe to Tailwind config:

- **Palette:** primary navy `#0A2540`, surface `#FFFFFF` and `#F6F9FC`, accent violet `#635BFF`, highlight amber `#B8860B`, text `#1A1F36` / `#64748B`
- **Type:** Inter (UI), Source Serif 4 (headings, topic titles)
- **Radii:** 6px standard, 10px for larger surfaces
- **Shadows:** soft, two-stop (see `src/styles.css` `--shadow-1`, `--shadow-2`, `--shadow-pop`)
- **Motion:** ~150ms ease-out for transitions, ~180ms cubic-bezier for thumb/scale
- **Light mode only**

Re-use the visual treatment, not the prototype JSX itself. The JSX is static demo code, not production.

---

## Folder layout

```
agora/
├── CLAUDE.md                 ← this file
├── Agora.html                ← design prototype (read-only reference)
├── src/                      ← prototype JSX (read-only reference)
├── specs/
│   ├── design-corrections.md
│   ├── schema.md
│   └── irv-spec.md
├── app/                      ← Next.js App Router routes
├── components/               ← shared UI primitives
├── lib/
│   ├── supabase/             ← clients, generated types
│   ├── irv.ts                ← tally algorithm
│   └── irv.test.ts           ← IRV tests
├── db/
│   └── migrations/           ← SQL migrations (append-only)
├── public/
└── package.json
```

---

## Build phases

Don't build it all in one pass. Each phase ends in something testable.

1. **Phase 1.** Next.js scaffold, Supabase project linked, env vars, schema migrations, IRV function with passing tests.
2. **Phase 2.** Auth flow: register, magic-link sign-in, awaiting-confirmation, awaiting-approval, rejected screens. Profile page.
3. **Phase 3.** Voter dashboard, topic detail with private + class-shared notes.
4. **Phase 4.** Ranking page (drag-to-reorder with @dnd-kit, draft ballot, final submission, locking).
5. **Phase 5.** Presenter upload flow, Supabase Storage integration, PDF preview generation.
6. **Phase 6.** Beadle/admin views: approval queue, voters table, topics admin, voting controls, audit log.
7. **Phase 7.** Results page (sequential IRV display, top 5 podium, exports). Deploy to Vercel. Dry-run with seed data.

Report back at the end of each phase with: what shipped, what's next, what blocked you, what assumptions you made. Wait for review before unblocking the next phase.

---

## Code conventions

- TypeScript strict mode. No `any` without an inline justification comment.
- File names: lowercase, hyphens (`topic-card.tsx`, not `TopicCard.tsx`).
- Component names: PascalCase in TS exports.
- Database columns: snake_case.
- Default to server components. Use client components only where interactivity (drag, autosave, modal state) requires.
- Server Actions for mutations; not API routes unless there's a reason.
- All database access through generated Supabase types (`supabase gen types typescript`).
- Conventional commits (`feat:`, `fix:`, `chore:`, etc.).
- Migrations are append-only — never edit a committed migration.

---

## Process

- Read context files first. Every session, no exceptions.
- Show a plan before executing any multi-step task. Wait for approval.
- Flag assumptions before acting. Don't guess on architecture; ask.
- If a source file or spec is incomplete, flag it before writing rather than improvising.
- For each phase: implement → run tests / type-check → take screenshots if visual → write a short hand-off summary → wait for review.

---

## Communication style (when speaking to Francis)

- **British English.** The Economist style guide. **No Oxford comma.**
- Direct, conversational, technical. Francis has a CS background and is a law student — don't over-explain code or systems.
- Include analogies when explaining complex topics.
- No filler language. **No AI-isms** (banned: "seamlessly", "effortlessly", "powerful", "robust", "delve", "comprehensive", "leverage").
- Lists only when they earn their keep — prefer prose.
- Talk like a teammate, not a chatbot.
- Flag risks. If something feels wrong, stop and ask.

---

## Output conventions

- File names: lowercase, hyphens. Date prefix when relevant (`2026-04-26-phase-3-summary.md`).
- `.docx` for client-facing documents.
- `.md` for internal drafts, specs, and notes.
- Don't write README files unless asked.

---

## Safety

- **Never delete files without explicit confirmation from Francis.**
- Don't modify files in `src/` (the design prototype) — read-only reference.
- Don't modify `Agora.html` — read-only reference.
- Don't introduce new top-level dependencies without flagging.
- Don't commit secrets. Use `.env.local` (gitignored). Document required env vars in `specs/`.
- Migrations are append-only. Never edit a committed migration; write a new one.

---

## How review works

Francis reviews each phase. Expect:

- Code review on each PR or phase deliverable.
- Pushback on architectural calls that weren't flagged in advance.
- Insistence on tests for the IRV algorithm specifically — that's the highest-stakes piece of logic.
- Visual QA against the prototype.

When in doubt: flag it, don't ship it.
