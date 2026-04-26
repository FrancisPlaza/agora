# Agora — Design Brief

A prompt for AI design tools (Claude Design, Figma Make, Google Stitch).

---

## What we're building

**Agora** is a ranked-choice voting and class-gallery web app for a Philippine law school class. In JDN101 Philosophy of Law at San Beda College Alabang, each of ~32 students presents one legal philosopher's thinking through a single piece of visual art (poster, painting, digital piece, or PDF), accompanied by a 5-7 sentence explanation and a 3-5 minute oral presentation. The class then ranks the presentations using sequential instant-runoff voting (IRV) to identify the top 5.

Agora handles: voter registration, beadle-mediated approval, the topic gallery (which fills in as students present), private and class-shared note-taking, ranked-choice voting, and the tally.

## Visual direction

**Name:** Agora — the Athenian public assembly.

**Reference points:** Stripe Dashboard for typography and whitespace discipline. Linear for crispness of interactions. Notion for the warmth of the gallery cards. Avoid heavy law-firm aesthetics (no oxblood, no gold filigree, no scales of justice icons).

**Palette:**
- Primary navy `#0A2540`
- Surface white `#FFFFFF` and off-white `#F6F9FC`
- Accent violet `#635BFF` (CTAs, links, current rank highlight)
- Highlight amber `#B8860B` (used sparingly — "your #1 pick", "Yours" pill on the user's own topic)
- Text primary `#1A1F36`, secondary `#64748B`

**Typography:**
- UI and body: **Inter** (weights 400, 500, 600, 700)
- Headings and topic titles: **Source Serif Pro** (weights 400, 600) — the single nod to the philosophical subject matter
- Tabular figures for rank badges and vote counts

**Surfaces:** Subtle angled-mesh gradient on the marketing hero and the results page only. Flat elsewhere. 6px corner radii. Soft shadows: `0 1px 3px rgba(10,37,64,0.06), 0 1px 2px rgba(10,37,64,0.04)`.

**Motion:** Snappy, not bouncy. Drag-to-rank should feel tactile — ghost preview, snap into place. Subtle row reorder transitions (~150ms ease-out). No skeuomorphism.

**Mode:** Light only for v1.

**Responsive:** Mobile-first. Most students will use this on their phones during class. Desktop layouts should not feel like stretched mobile.

## User roles

1. **Voter** — every approved student.
2. **Presenter** — a voter assigned to a topic. Same UI as voter, plus an upload flow for their own topic.
3. **Beadle (admin)** — a voter with admin rights; up to two beadles supported via a flag, not a separate role.

## Topic lifecycle

Each of the 32 topics moves through four states:

- **Unassigned** — title only.
- **Assigned** — presenter named, presentation date may be set.
- **Presented** — beadle has marked the presentation done in class; the presenter can now upload art.
- **Published** — presenter has uploaded artwork, art title, and 5-7 sentence explanation.

The state is derived from which fields are populated, not stored as a column. Cards visually evolve as topics move through states.

## Screens

### Public (pre-auth)

**1. Landing (`/`)**
- Hero with logo wordmark "Agora", tagline "Ranked-choice voting for JDN101 Philosophy of Law", short description.
- Two CTAs: "Sign in" / "Register".
- Footer with class context.

**2. Register (`/register`)**
- Fields: full name, school email, student ID.
- CTA: "Create account".
- Sub-link: "Already have an account? Sign in".
- Reassurance line: "Your beadle will approve your account before you can vote."

**3. Sign in (`/signin`)**
- Single email field.
- CTA: "Send magic link".
- Post-submit state: "Check your inbox" with masked email.

**4. Awaiting email confirmation**
- Quiet card. "Confirm your email" heading. Body explains the link.

**5. Awaiting beadle approval**
- Quiet card. "Pending approval" heading. Body explains the beadle will review. Sign-out option.

**6. Rejected**
- Card with explanation. Beadle contact info. Sign-out.

### Voter (authenticated, approved)

**7. Dashboard (`/dashboard`)** — the cornerstone screen
- Top status banner. Examples:
  - "Voting opens in 4 days. Take notes as presentations happen."
  - "Voting open until 30 May, 11pm. You've ranked 18 of 32."
  - For a presenter who's been marked presented but hasn't uploaded: "Your turn — upload your presentation".
- Below banner: 32 topic cards in a 3-column grid (1-column on mobile, 2-column on tablet).
- Card content varies by state:
  - **Unassigned**: pale card. Topic number (small, top-left). Philosopher and title in serif. Italic footer "Presenter TBA".
  - **Assigned**: same plus "To be presented by [name]" and presentation date if set.
  - **Presented**: same plus "Presented [date]" and a small inline "Take notes" link.
  - **Published**: artwork as the card hero (60% of card height), title and philosopher below, "by [name]", small note count badge.
- The current user's own topic carries an amber "Yours" pill in the top-right of the card across all states.
- Filter tabs above the grid: All / Published / Presented / Unassigned / My notes.
- Persistent navigation: Dashboard, Vote, Profile (top bar on desktop, bottom tab bar on mobile).

**8. Topic detail (`/topic/[id]`)**
- Hero: artwork (if published) full-bleed, or a serif placeholder with the topic title.
- Below hero: art title, philosopher, presented date, presenter name, 5-7 sentence explanation as a single readable paragraph block.
- Two tabs below: **My notes** | **Class notes** (count badge).
  - **My notes**: a simple textarea, autosave indicator ("Saved · 2s ago"), visibility toggle as a labelled switch ("Private" ↔ "Shared with class") with a small lock/unlock icon transition.
  - **Class notes**: list of shared notes by other students. Each entry: author name, timestamp, note text. Sort: most recent first.
- Sticky bottom-right action: "Add to my ranking" button (jumps to ranking page with this topic pre-focused).

**9. Ranking page (`/vote`)**
- Two-column on desktop, single-column with collapsible sections on mobile.
- Left column: **Unranked**. Searchable list of topics not yet ranked, with art thumbnails.
- Right column: **My ranking**. Ordered list. Each row: large rank number on the left, art thumbnail, philosopher name, art title. Drag handles. Drag to reorder.
- Rank #1 row carries a subtle amber accent left-border.
- Save indicator: "Draft saved · 2m ago".
- Bottom action bar (sticky):
  - Polls closed: muted message "Polls open [date]".
  - Polls open, not submitted: large primary "Submit final ballot" CTA.
  - Submitted: disabled "Ballot locked" with a "View ranking" toggle for read-only review.
- Empty state for the right column: a soft illustration plus "Drag a topic from the left to start your ranking."

**10. Submit-ballot confirmation modal**
- Heading: "Submit your final ballot?"
- Summary: "You ranked X of 32 topics. Unranked topics count as no preference."
- Warning line: "Once submitted, your ballot is locked."
- Buttons: "Cancel" / "Submit ballot".

**11. Profile (`/profile`)**
- Email (read-only), student ID (read-only), full name (editable).
- If user is a presenter: assigned topic with status ("Presenting on [date]" / "Presented — upload your art" / "Published").
- Sign out.

**12. Presenter upload (`/topic/[id]/upload`)**
- Accessible only if the user is the assigned presenter for this topic AND the topic is in **Presented** state.
- Form fields:
  - Art title (text input).
  - File uploader: drag-drop area, accepts JPG/PNG/WEBP/HEIC/PDF, 10MB max. Preview thumbnail after upload.
  - Explanation: textarea with a sentence-count helper (target 5-7).
- Live preview: shows how the topic card will appear on the dashboard once published.
- CTA: "Save and publish".
- Edit mode: same form pre-populated, CTA changes to "Update".

### Beadle (admin)

**13. Admin home (`/admin`)**
- Three summary cards across the top:
  - "Pending approvals" — count, click-through.
  - "Topics not yet presented" — count, click-through.
  - "Ballots submitted" — "X of Y".
- Below: an audit log timeline of recent admin actions (who approved whom, who marked which topic presented, who triggered tally).

**14. Approval queue (`/admin/approvals`)**
- Table of pending voters: name, email, student ID, registered timestamp, plus a "Topic" dropdown to assign.
- Per-row actions: "Approve" (disabled until topic assigned) and "Reject".
- Topics already assigned appear greyed out in the dropdown.

**15. Voters (`/admin/voters`)**
- Table of all voters: name, email, status (pending/approved/rejected), assigned topic, ballot status (not started / draft / submitted).
- Filter chips by status.
- Per-row actions: revoke approval, reassign topic.

**16. Topics admin (`/admin/topics`)**
- All 32 topics in a list. State badges (unassigned / assigned / presented / published).
- Per-row actions: "Mark as presented", "Reassign", "Edit metadata".
- Filter chips by state.

**17. Voting controls (`/admin/voting`)**
- Set or edit deadline (datetime picker).
- "Lock ballots now" with confirmation.
- "Run tally" disabled until ballots locked.
- Submission progress meter (X of Y ballots submitted).

**18. Results (`/admin/results`)**
- Hero: top 5 in a podium-style row, each with artwork thumbnail, philosopher name, presenter, and a position badge (#1 to #5).
- Below: tabs for each of the 5 sequential IRV runs.
  - Each tab presents the rounds of that run as a vertical timeline: round number, vote counts as horizontal bars, who got eliminated, redistribution arrows.
- "Export results" → CSV / PDF.

## Key interactions to nail

- **Drag-to-rank.** Snappy. Ghost preview follows cursor/touch. Snap-into-place on drop. Auto-save after every drop.
- **Notes autosave.** Every 5s of inactivity, with a quiet "Saved" indicator.
- **Visibility toggle on notes.** Animated lock-to-unlock icon transition. Toast confirmation: "Note shared with class" / "Note set to private".
- **Ballot submission.** One-way commit. Friction via modal with summary and explicit confirm.
- **Beadle approval.** Two-click flow: select topic from dropdown, then approve.
- **Presenter upload.** Drag-drop with live preview of the resulting dashboard card.

## States to design for

- All four topic-card states (unassigned, assigned, presented, published).
- Empty states (no notes yet, polls not open, no rankings yet, no admin actions yet).
- Locked ballot (read-only ranking view).
- Rejected user state.
- PDF artwork (first-page preview rendered as image).
- Loading skeletons on all data-bearing screens.

## Microcopy tone

Direct, conversational, mildly academic. **British English. No Oxford comma. No AI-isms** ("seamlessly", "effortlessly", "powerful", "robust" — banned).

Examples to follow:
- "Drag your favourites to the right. Order them best to worst."
- "Pending approval. Your beadle will review shortly."
- "Notes are private until you flip the switch."
- "Once you submit, your ballot is locked."
- "Your turn — upload your presentation."

## Component sheet wanted

- Buttons (primary, secondary, ghost, destructive, disabled).
- Form fields (text, textarea, select/dropdown, file upload, switch/toggle, datetime).
- Topic cards in all four states.
- Note items (own + shared variants).
- Ranking row (with drag handle).
- Modals (confirmation, info, error).
- Toast notifications.
- Status badges (topic state, voter status, ballot status).
- Empty-state illustrations.
- Navigation (top bar desktop, bottom tab bar mobile).

## Deliverables wanted

- High-fidelity mockups for all 18 screens.
- Mobile and desktop variants for the 5 highest-traffic screens: dashboard, topic detail, ranking, admin home, results.
- Component sheet covering the items above.
- Light mode only.
