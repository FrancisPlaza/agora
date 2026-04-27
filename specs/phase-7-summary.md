# Phase 7 Summary — Results page + sandbox deploy prep

The closing build phase. The `/admin/results` Phase 6 stub is gone, replaced by a public-to-voters `/results` page that renders the top-five podium, per-run IRV timelines, two CSV exports, and a print stylesheet that fits a single browser-rendered PDF. The dashboard learns a sixth banner variant ("results posted") and topic cards gain medal pills for the five winners. A `scripts/seed-sandbox.ts` script populates a fresh Supabase project with 10 fake voters, six presented topics with placeholder art, five submitted ballots, and a real IRV tally — so a sandbox deploy is one `npx tsx` away from a fully-populated review state. A `specs/deploy.md` runbook walks you (Francis) from fresh clone to running sandbox in about twenty minutes.

End-to-end verified in a real browser against local Supabase + the seeded data: dashboard banner, top-5 medals, podium, all five run tabs, both CSV downloads (RFC 4180 quoting confirmed on commas in art titles), and the print-stylesheet hides the right chrome.

**Sandbox URL:** _TBD — Francis to fill in after running the deploy.md runbook._

## What shipped

### Data layer

- `lib/data/results.ts` — two `cache()`'d helpers. `getResults()` returns `ResultsView | null` (runs[1..5] with winner topic id, totalBallots, exhaustedCount, rounds[], tallyRunAt, totalRounds). `getResultsTopicMap()` returns the `Map<number, TopicView>` keyed by every topic referenced in any round so the timeline can render names without 32 individual lookups. The `tally_results.rounds` jsonb column types as `Json` but the runtime shape is `RoundResult[]` from `lib/irv.ts` — cast through `unknown as ResultsRunRow[]` with an inline justification.

### Page & components

- `app/(authed)/results/page.tsx` — server component. URL-driven `?run=N` (1..5, default 1). `requireApproved()` gate (any approved voter, including non-admins). Empty state when `tally_results` has no rows yet. Header strip (Tally completed timestamp + Top 5 CSV + Rounds CSV + Print). Hero ("The class chose its top five."). Podium. Run tabs + active timeline. RESULTS_BG inline gradient set via `style=`; overridden in print via `[data-results-page]` selector in `globals.css`.
- `app/(authed)/results/podium.tsx` — five-card grid (1 hero card + 4 below). Real artwork via `getTopicArtUrl({w:400,h:400})` when the winner topic has uploaded art; `ArtPlaceholder` fallback otherwise. Vacant runs (all candidates exhausted before a winner emerged) render an "Insufficient preferences" card. Trophy badge on the #1 card.
- `app/(authed)/results/run-timeline.tsx` — five-stat row across the top (Winner, Rounds, First-round leader, Decided in, Final share). Vertical list of rounds; each round shows per-candidate vote counts with a horizontal bar (longest = leader) and badges for `eliminated` / `winner`. Eliminated candidates dim and render strikethrough.
- `app/(authed)/results/print-button.tsx` — small client wrapper around `window.print()`. Exists only so the parent server component stays server-rendered.

### CSV routes

- `app/api/results/csv-shared.ts` — `csvField` (RFC 4180 quoting: doubled inner quotes, wraps any value with comma/quote/newline), `csvRow`, `csvResponse` (`text/csv; charset=utf-8` + `Content-Disposition: attachment` + `Cache-Control: no-store`), `notFoundResponse`.
- `app/api/results/top-5.csv/route.ts` — one row per run. Columns: `position, topic_id, philosopher, theme, art_title, presenter, final_share, total_ballots`. Vacant runs emit a row with empty winner fields. Gates on `requireApproved()`.
- `app/api/results/rounds.csv/route.ts` — one row per (run, round, candidate). Columns: `run, round, topic_id, philosopher, theme, votes, share, eliminated, winner`. Uses `getResultsTopicMap()` for philosopher/theme lookup so a 5-run × 32-candidate × N-round file is a single DB read.

### Dashboard updates

- `components/ui/status-banner.tsx` — `'success'` added to `BannerTone`. Class: `bg-[#E1F2EA] border-[#B7DCC6] text-[#1F5D3A]`. Same shape as the other tones.
- `components/topic-card.tsx` — `Medal` type exported (`1 | 2 | 3 | 4 | 5`). New `medal?` prop. `MedalPill` component renders top-right of the card alongside the existing "Yours" pill. Gold (#F4C95B) / silver (#C8CDD3) / bronze (#D1A77C) / two surface-alt for #4 and #5. The #1 medal renders "★ #1"; #2..5 render `#N`. ARIA-labelled.
- `app/(authed)/dashboard/page.tsx` — `getResults()` joined into the Promise.all. `medalByTopicId: Map<number, Medal>` built from `results.runs.filter(r => r.winner)`. `pickBanner()` gains a `resultsPosted` variant (success-green) at priority 2 — after the presenter-amber upload prompt, before the polls-closed amber. Copy: "Results are in. The class voted [winner] best presentation. See the top five." with View results CTA → `/results`.

### Print stylesheet

- `app/globals.css` — `@media print` rules. `-webkit-print-color-adjust: exact; print-color-adjust: exact;` so the medal pills, podium gradient, and bar chart keep their colours. White page background. `[data-results-page]` overrides the on-screen RESULTS_BG inline gradient.
- `components/nav/{top,bottom}-nav.tsx` — both nav elements gain `print:hidden`. Without this the print preview wastes a quarter of the page on chrome.
- Page-level `print:hidden` on the header strip (CSV + Print buttons), the run tabs strip, and the on-screen RESULTS_BG gradient. A `hidden print:block` "Run N — [Winner]" heading appears in print so the printed page identifies which run's timeline is on it.

### Route move

- `app/(authed)/admin/results/` deleted. The Phase 6 stub at `/admin/results` is gone; admins follow the same `/results` link as voters. `lib/actions/admin.ts` `runTallyFromAdmin` redirect target updated to `/results`. Voters and admins see the same page; admins additionally see a small "Beadle" badge in the header strip (no extra capability — informational only).

### Sandbox seed

- `scripts/seed-sandbox.ts` — service-role node script (~280 lines). Creates 10 voters (`seed-voter1@sanbeda.edu.ph` through `seed-voter10@sanbeda.edu.ph`) via `auth.admin.createUser` with `email_confirm: true`. The first voter is also flagged `is_admin = true`. Assigns topics 1..10 to the 10 seeded voters. Marks topics 1..6 presented; uploads synthetic 8×8 PNGs (hand-rolled with `deflateSync` from `node:zlib` — no image library dependency) to topics 1..4 storage and writes the published-state fields. Inserts 5 submitted ballots (each ranking 5..15 of the 32 candidates, with overlap so IRV produces meaningful runs). Runs the real `lib/irv.ts` `tally()` and writes `tally_results` server-side. Idempotent: re-runs detect existing seed users by email and skip the create step; ballots and tally are wiped and rewritten so the resulting state is reproducible.
- **Safety guard.** The script aborts unless `SUPABASE_URL` contains `127.0.0.1` / `localhost` OR `AGORA_SEED_OK=true` is explicitly set in the env. Verified: refused with exit code 2 against `https://example-prod.supabase.co` with no override; with the override + a bad URL it failed at DNS resolution before any data was touched. The override is intentional friction; the runbook flags it loudly.

### Deploy runbook

- `specs/deploy.md` — eight-step recipe from fresh clone to a running sandbox on Vercel + cloud Supabase. Covers project creation, the `supabase db push` migration apply, Auth URL configuration (with the chicken-and-egg note about the Vercel-assigned URL), Vercel env-var table, first-deploy smoke check, the one-time admin SQL bootstrap, the seed script run, and an end-to-end verification walk. Production deploy lives at the bottom as a checklist + delta — not a separate runbook, since 90% of the steps are identical and the differences are best read alongside the sandbox steps.

## Deviations from the brief

None. The brief's structure carried through cleanly, with one helpful addition: the seed script's `AGORA_SEED_OK` override is more friction than the brief asked for, but it gives Francis a way to seed against a non-local URL without editing the script (e.g. if he wants to seed a sandbox cloud project for review purposes). The override is documented in `deploy.md` and the script's safety message.

## Migration count

**16.** Phase 7 added no migrations — the `tally_results` table from Phase 1.5 already had everything Phase 7 needed.

## Test accounts (after running the seed script)

All have `@sanbeda.edu.ph` emails, magic-link only. The seed script prints the full list to stdout.

| Email | Role | Notes |
|---|---|---|
| `seed-voter1@sanbeda.edu.ph` | **Admin** + voter (Topic 1: David Hume) | Bypasses the SQL bootstrap step |
| `seed-voter2@sanbeda.edu.ph` | Voter (Topic 2: Jeremy Bentham) | Has a submitted ballot |
| `seed-voter3@sanbeda.edu.ph` | Voter (Topic 3: John Austin) | Has a submitted ballot |
| `seed-voter4@sanbeda.edu.ph` | Voter (Topic 4: Hans Kelsen) | Has a submitted ballot |
| `seed-voter5@sanbeda.edu.ph` | Voter (Topic 5: Thomas Hobbes) | Has a submitted ballot |
| `seed-voter6@sanbeda.edu.ph` | Voter (Topic 6: Herbert Hart) | Has a submitted ballot |
| `seed-voter7..10@sanbeda.edu.ph` | Voter (Topics 7..10) | No ballot — the dashboard banner shows the polls-closed variant |

After seed, the IRV tally winners (run 1..5) are: David Hume, Jeremy Bentham, H.L.A. Hart, Confucianism, G.W.F. Hegel — five distinct candidates across the runs as the algorithm requires. 148 rounds total across the five runs (high because 5 ballots vs 32 candidates means lots of single-elimination — that's correct behaviour, not a bug).

## What to look at first when reviewing

1. **The print stylesheet.** Open `/results`, hit Cmd+P. Should show the hero, podium, and the active run's timeline — no nav, no run tabs, no CSV/Print buttons in the print preview. The active run gets a "Run N — [Winner]" heading at the top of its timeline section. The medal pills, podium colours, and bar chart all keep their colour (it's the most likely thing to break across browsers' print engines).
2. **CSV correctness.** Download both. Open in Excel / Numbers / a text editor. Confirm `final_share` and `share` are percentages 0-100 with one decimal place. RFC 4180 quoting around values containing commas (e.g. 'Legalism, or Rule by the Law').
3. **Medal precedence + the "Yours" badge stack.** The first seeded voter owns Topic 1, which is also the run-1 winner. So that card should display BOTH the gold medal pill AND the "Yours" pill, stacked vertically, top-right.
4. **Banner precedence.** With the seed loaded, the dashboard banner should be the success-green "Results are in." variant — it outranks the polls-closed amber. If you SQL-clear the tally (`delete from tally_results;`), it should fall back to amber.
5. **Run tabs.** Click through Run 2..5. The hero copy, podium, and active timeline don't change between tabs — only the timeline beneath. The five winners are distinct (sequential IRV's whole point).
6. **The deploy runbook.** Read `specs/deploy.md` end-to-end before running it. The chicken-and-egg in step 4.5 (Vercel-assigned URL → Auth URL config) is the most likely place to trip up.

## Production deploy checklist (subset for reference)

The full version is at the bottom of `specs/deploy.md`. The deltas vs sandbox:

- Separate Supabase project (`agora-production`). Separate Vercel project. Custom domain mapped + Auth URL Configuration updated to use it.
- `NEXT_PUBLIC_BEADLE_CONTACT` env var: real beadle contact line(s), not the placeholder.
- Bootstrap SQL run for the two real beadles (Beadle Lim + Beadle Cruz), not the test beadle.
- `scripts/seed-sandbox.ts` **never run** against production — the safety guard refuses without an explicit `AGORA_SEED_OK=true` override, and even then the URL check is the last line of defence.
- Confirm Supabase backups are on (free tier may not include daily snapshots).
- Confirm email deliverability — Supabase's transactional email has a low default quota; for 32 students it's fine but the domain could be throttled if Supabase's IP reputation slips.

The code itself is the same on both deploys. Migrations are the same. Only the data differs.

## Outstanding (Phase 8 / post-launch)

- **Email-template customisation.** Supabase's defaults are functional but generic. Brand the magic-link and confirmation emails before the production deploy goes live to the class.
- **Print preview tuning across engines.** Verified in Chrome. Safari and Firefox may render the bar-chart bars slightly differently due to print-color-adjust quirks. Worth a manual check before the production print is used to tape results to the classroom door.
- **Class-export bundle.** A "download everything" button — top-5 + rounds + maybe a class-shared notes export — for archival once the term ends. Out of scope for v1.
- **Real bootstrap data import.** The 32 topics seed is correct as of the current syllabus draft. If the topic list shifts before the term, edit migration 0006 (NOT a new migration) before any production migrations are pushed; otherwise add a corrective migration.

## Files touched

```
NEW   app/(authed)/results/page.tsx
NEW   app/(authed)/results/podium.tsx
NEW   app/(authed)/results/run-timeline.tsx
NEW   app/(authed)/results/print-button.tsx
NEW   app/api/results/csv-shared.ts
NEW   app/api/results/top-5.csv/route.ts
NEW   app/api/results/rounds.csv/route.ts
NEW   lib/data/results.ts
NEW   scripts/seed-sandbox.ts
NEW   specs/deploy.md
NEW   specs/phase-7-summary.md  (this file)

MOD   app/globals.css                       (+@media print rules)
MOD   app/(authed)/dashboard/page.tsx       (results banner + medal map)
MOD   components/ui/status-banner.tsx       (+'success' tone)
MOD   components/topic-card.tsx             (+Medal type, MedalPill)
MOD   components/nav/top-nav.tsx            (+print:hidden)
MOD   components/nav/bottom-nav.tsx         (+print:hidden)
MOD   lib/actions/admin.ts                  (redirect /admin/results → /results)

DEL   app/(authed)/admin/results/           (Phase 6 stub — superseded)
```

Six commits total, ending here.
