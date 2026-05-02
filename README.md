# Agora

Ranked-choice voting and class gallery for JDN101-1Q Philosophy of Law at SBCA School of Law. Agora is the gallery where the class can deliberate democratically and visualise consensus together.

Each student presents one legal philosopher through a piece of artwork, a short written explanation, and a 3-5 minute oral presentation. The class then ranks all presentations using sequential instant-runoff voting (IRV) to identify the top five. The dashboard fills in over the term as students present and upload their work, becoming a study aid for voting and beyond.

---

## Tech stack

- **Framework:** Next.js 16 (App Router, TypeScript strict)
- **Backend:** Supabase (Postgres + Auth + Storage + Row-Level Security)
- **Auth:** Supabase magic-link only — no passwords
- **Hosting:** Vercel
- **Styling:** Tailwind CSS, brand tokens transcribed from the design prototype
- **Drag and drop:** `@dnd-kit/core` + `@dnd-kit/sortable`
- **Animations:** Framer Motion (used sparingly)

The full design system, screen prototypes, and tone reference live in `Agora.html` and `src/*.jsx` (read-only — production code is in `app/` and `components/`).

---

## Local development

### 1. Prerequisites

- Node.js (use the version pinned in `package.json` `engines` if set; otherwise the current LTS)
- The Supabase CLI
- A Supabase project (sandbox is fine for local dev)

### 2. Install

```bash
git clone <repo-url>
cd agora
npm install
```

### 3. Environment variables

Copy `.env.example` to `.env.local` and fill in:

```
NEXT_PUBLIC_SUPABASE_URL              — your project URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY  — publishable (anon) key
SUPABASE_SECRET_KEY                   — secret (service-role) key. Server-only.
NEXT_PUBLIC_SITE_URL                  — http://localhost:3000 for local
NEXT_PUBLIC_BEADLE_CONTACT            — email shown on the awaiting-approval screen
```

The `SUPABASE_SECRET_KEY` bypasses Row-Level Security and is read only by server-side code (the IRV tally function, admin endpoints, the seed scripts). Never expose it via `NEXT_PUBLIC_*`.

### 4. Database

Apply migrations to your Supabase project:

```bash
supabase link --project-ref <ref>
supabase db push
```

Migrations are append-only — never edit a committed migration; write a new one. The seed migration (`0006_seed_topics.sql`) populates the 32 topics from the JDN101 syllabus automatically.

For sandbox / dev work, additional fixtures load via:

```bash
npm run seed:sandbox
```

For production admin bootstrap (the beadles and the professor), see `specs/seed-prod-admins.md`.

### 5. Run

```bash
npm run dev
```

Open `http://localhost:3000`. Register a test account with any email; the magic-link goes to your local Supabase Inbucket if you've configured it, otherwise the actual email.

---

## Scripts

| Command | What it does |
|---|---|
| `npm run dev` | Start the Next.js dev server |
| `npm run build` | Production build |
| `npm run start` | Run the production build |
| `npm run lint` | ESLint |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run test` | Run the test suite (the IRV tests are the most important — see below) |
| `npm run seed:sandbox` | Populate sandbox fixtures |
| `npm run seed:prod-admins` | One-off prod admin seed (see deploy checklist) |

---

## Folder layout

```
agora/
├── app/                      Next.js App Router routes
├── components/               Shared UI primitives
├── lib/
│   ├── supabase/             Clients, generated types
│   ├── irv.ts                Tally algorithm
│   └── irv.test.ts           IRV tests
├── supabase/
│   ├── migrations/           SQL migrations (append-only)
│   └── email-templates/      Magic-link email HTML for paste into the dashboard
├── scripts/                  One-off seed and admin scripts
├── specs/                    Working specs, phase summaries, deploy checklist
├── public/                   Static assets
├── Agora.html                Design prototype (read-only)
├── src/                      Prototype JSX (read-only)
└── CLAUDE.md                 Project instructions (read first)
```

---

## Testing

The most consequential code in the repo is the tally algorithm. The test suite has high coverage of `lib/irv.ts` against worked-example fixtures whose expected outcomes are documented in `specs/irv-spec.md`.

```bash
npm run test
```

The full `irv.test.ts` file covers: single-winner runs, sequential five-winner runs, deterministic tie-breaks, exhausted ballots, partial rankings, and edge cases like a single-voter election and unanimous ballots.

---

## Verifying and auditing the IRV tally

This section is for anyone who wants to confirm — independently — that the published election results match what the documented algorithm would produce given the cast ballots. Voting integrity matters more than convenience; the design choices below are deliberate.

### What Agora promises

The tally is **sequential instant-runoff voting** as documented in `specs/irv-spec.md`. The algorithm:

1. Counts first-preference votes for every topic.
2. Identifies the topic with the most first-preference votes; if it has more than half of all valid ballots' top preferences, it wins this round. Otherwise, eliminate the topic with the fewest first-preference votes (with documented tie-break rules) and redistribute its ballots to their next-preference choice.
3. Repeats until one topic crosses the majority threshold. That topic is the round winner.
4. **Removes the winner and all rankings of it from every ballot**, then repeats steps 1-3 to find the next winner. The process runs five times to identify the top five.
5. Tie-breaks are deterministic: ties between topics with the fewest first-preference votes are broken by topic order number (lower order number eliminated first), with no random choice anywhere in the algorithm.

The full specification — including all tie-break edge cases and the exact data structure for each round's output — lives in `specs/irv-spec.md`. That spec is the contract `lib/irv.ts` implements.

### Ballot secrecy guarantees

Beadles can see *that* a voter has submitted a ballot but not *what* they ranked. This is enforced at three layers:

1. **Schema-level RLS.** The `rankings` table has a Row-Level Security policy that allows `SELECT` only for the row's own `voter_id`. Beadles' `SELECT` access is restricted to `ballots.voter_id` and `ballots.submitted_at` — never to ranking contents. Inspect the relevant migrations under `supabase/migrations/` (search for `policy` and `rankings`).
2. **Server-side tally.** The tally function runs as `service_role` (bypassing RLS) inside a Supabase function, computes the IRV result, and returns only aggregates: per-round counts, eliminated/winning topic IDs, exhausted-ballot counts. No individual ballot ever leaves the function.
3. **Open inspection.** Anyone with repo access can read every line of the tally code, every migration, and every RLS policy. The trust property is open code, not closed promises.

### How to independently verify a tally

1. **Clone and install.**

   ```bash
   git clone <repo-url>
   cd agora
   npm install
   ```

2. **Read the specification.** `specs/irv-spec.md` is plain English; an auditor without TypeScript fluency can still understand what the algorithm should do.

3. **Run the test suite.**

   ```bash
   npm run test
   ```

   All IRV tests must pass. The tests in `lib/irv.test.ts` are worked examples whose expected outcomes match the specification. If any test fails, the implementation has drifted from the contract and the deployed tally is suspect.

4. **Inspect the implementation.** `lib/irv.ts` is intentionally short and readable. There is no off-the-shelf voting library — the algorithm is implemented in plain TypeScript so it can be audited line by line.

5. **Re-tally from anonymised ballot data.** After polls close, the beadle can export the cast ballots in anonymised form (a CSV of `ballot_id, topic_id, rank` rows — `ballot_id` is a random UUID with no link to a voter identity in the export). Save that file, then run the algorithm against it locally:

   ```bash
   # The export workflow and re-tally script are described in
   # `specs/irv-audit.md` (to be added; see Open audit work below).
   npm run audit:tally -- path/to/exported-ballots.csv
   ```

   The output should match the published top-five exactly. Any discrepancy is a verification failure and should be raised with the beadle for investigation.

6. **Cross-check the public results.** The deployed app's results page exposes per-round counts, eliminated topics, and the running winner list — exactly the same structure the auditor's local re-tally will produce. Any auditor can compare their local output against the public results page side by side.

### Open audit work

Two pieces are tracked but not yet shipped at the time of writing:

- **`specs/irv-audit.md`** — a step-by-step audit guide for someone who isn't a developer, including how to install Node, run the tests, and interpret the output. The current README assumes a developer audience.
- **`npm run audit:tally`** — a CLI that consumes the anonymised ballot CSV and emits a re-tally. The same `lib/irv.ts` function is invoked, so what's tested is what's run.

If you're auditing the tally before either is shipped, the existing `npm run test` run plus a manual side-by-side of `lib/irv.test.ts` fixtures versus the published results page is sufficient as a first-pass check. Raise concerns with the beadle for any deeper audit work.

---

## Deploy

The full deploy procedure lives in `specs/deploy-checklist.md`. Highlights:

- Vercel project linked to the repo, production branch `main`, region `sin1` (Singapore — closest to Manila).
- Production Supabase project separate from sandbox.
- Magic-link emails configured in Supabase → Authentication → Email Templates from `supabase/email-templates/`.
- Admins seeded via `npm run seed:prod-admins` (one-off after `supabase db push`).
- Smoke-test the magic-link flow before sharing the URL with the class.

---

## Conventions

The full set lives in `CLAUDE.md`. The non-negotiables:

- TypeScript strict. No `any` without an inline justification.
- Server components by default; client components only where interactivity demands it.
- Server Actions for mutations; not API routes unless there's a reason.
- Migrations are append-only.
- File names lowercase-with-hyphens. Component names PascalCase in TS exports. DB columns snake_case.
- Conventional commits.
- British English in all UI copy and documentation. The Economist style. No Oxford comma.

---

## License

MIT. See `LICENSE` for the full text. Copyright © 2026 Francis Plaza.

The IRV implementation, RLS policies, and audit-friendly choices are deliberately open and reusable. If you adapt Agora for another class or institution, attribution back to this repo is welcome but not required by the licence.
