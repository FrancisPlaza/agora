# Agora — Design Brief

Ranked-choice voting + class gallery web app for a Philippine law school class (JDN101 Philosophy of Law, ~32 students). Each student presents one legal philosopher via one visual artwork (image or PDF) + 5-7 sentence explanation + 3-5 min talk. Class then ranks presentations via sequential IRV to find the top 5.

## Brand

Stripe-clean. Generous whitespace, sharp type, one serif nod to philosophy. No law-firm clichés.

Palette: primary `#0A2540` navy; surface `#FFFFFF` + `#F6F9FC`; accent `#635BFF` violet (CTAs, current rank); highlight `#B8860B` amber (sparingly — "Yours" pill, #1 pick); text `#1A1F36` / `#64748B`.

Type: Inter (UI); Source Serif Pro (headings + topic titles).

Surfaces: subtle angled-mesh gradient on hero + results only; flat elsewhere; 6px radii; soft shadows. Motion snappy ~150ms ease-out. Mobile-first. Light mode only.

## Roles & topic states

Roles: Voter · Presenter (voter assigned a topic) · Beadle (voter with admin flag, up to 2).

Topic lifecycle: **Unassigned** → **Assigned** (presenter named) → **Presented** (beadle marked done) → **Published** (presenter uploaded art + title + explanation).

## Screens

**Public**

1. Landing — wordmark, tagline "Ranked-choice voting for JDN101 Philosophy of Law", Sign in / Register.
2. Register — name, email, student ID. Reassurance: beadle will approve before voting.
3. Sign in — email + "Send magic link", post-submit "Check your inbox".
4-6. Quiet status cards: awaiting email confirmation, awaiting beadle approval (with sign-out), rejected (with beadle contact).

**Voter (auth + approved)**

7. **Dashboard** (cornerstone). Top status banner ("Voting opens in 4 days" / "You've ranked 18 of 32" / presenter prompt "Your turn — upload your presentation"). 32 topic cards, 3-col desktop / 2-col tablet / 1-col mobile. Card by state:
   - Unassigned: pale, topic # + philosopher + title in serif, italic "Presenter TBA".
   - Assigned: + "To be presented by [name]".
   - Presented: + "Presented [date]" + inline "Take notes".
   - Published: artwork hero (60% of card), title, philosopher, "by [name]", note-count badge.
   User's own topic: amber "Yours" pill top-right in every state. Filter tabs: All / Published / Presented / Unassigned / My notes.
8. **Topic detail** — artwork hero (or serif placeholder), art title, philosopher, presenter, date, 5-7 sentence explanation. Tabs: My notes | Class notes (count). My notes = textarea + autosave + Private/Shared switch with lock-icon transition. Class notes = list (author, time, text). Sticky "Add to my ranking" CTA.
9. **Ranking page** — 2-col desktop, 1-col mobile. Left: searchable Unranked list with thumbnails. Right: My ranking — drag-to-reorder rows (large rank #, thumbnail, philosopher, art title). #1 row has amber left-border. "Draft saved 2m ago". Sticky bottom: "Submit final ballot" / "Polls open [date]" / "Ballot locked".
10. Submit modal — "Submit your final ballot? You ranked X of 32. Once submitted, locked." Cancel / Submit.
11. Profile — email + ID (read-only), name (editable). Presenter sees assigned topic + status. Sign out.
12. **Presenter upload** — gated: user is assigned presenter AND topic in Presented. Fields: art title; drag-drop uploader (JPG/PNG/WEBP/HEIC/PDF, 10MB); explanation with sentence-count helper. Live preview of resulting card. CTA "Save and publish".

**Beadle (admin)**

13. Admin home — 3 cards (Pending approvals, Topics not yet presented, Ballots submitted X of Y); audit-log timeline.
14. Approval queue — table (name, email, ID, registered) + Topic dropdown (assigned ones greyed). Approve (gated on topic) / Reject.
15. Voters — table: name, email, status, topic, ballot status (not started / draft / submitted). Filter chips. Revoke / reassign.
16. Topics admin — 32 rows with state badges. Mark presented / Reassign / Edit.
17. Voting controls — deadline picker, "Lock ballots now" (confirm), "Run tally" (disabled until locked), submission meter.
18. **Results** — top 5 in podium row (thumbnails + position badges). Tabs for each of 5 sequential IRV runs; per-tab timeline of rounds with horizontal bar charts of vote counts + elimination arrows. Export CSV/PDF.

## Interactions

Drag-to-rank: ghost preview, snap, autosave. Notes autosave every 5s. Visibility toggle: lock↔unlock + toast. Ballot submit: modal, one-way commit. Upload: drag-drop + live preview. Also design empty states, locked ballot (read-only), PDF first-page preview, loading skeletons.

## Microcopy

Direct, conversational, mildly academic. British English. No Oxford comma. No AI-isms (banned: seamlessly, effortlessly, powerful, robust). E.g. "Drag your favourites to the right." · "Pending approval. Your beadle will review shortly."

## Deliverables

High-fi mockups for all 18 screens. Mobile + desktop for dashboard, topic detail, ranking, admin home, results. Component sheet: buttons, fields, topic cards (4 states), ranking row, modals, toasts, badges, nav.
