# Agora — Design Corrections

Apply these during the build. The Claude Design prototype (`Agora.html` and `src/*.jsx`) is solid as a visual reference — palette, typography, motion, and screen layouts are locked. Five things deviate from the brief and a handful of polish items need a pass before code-gen.

---

## Substantive corrections

### 1. Schema models topics, not philosophers

The prototype's data model treats each row as one philosopher with one work. The real syllabus has Bentham across three topics (Principles of Morals, Felicific Calculus, Originalism) and Unger across two (Hegemony, Cultural Context). Production schema must use **topics** as the primary entity, with `philosopher` and `theme` as fields — not a join through a separate philosophers table.

Topic shape:

```sql
topics
  id                  integer primary key
  order_num           integer not null      -- syllabus order, 1..32
  philosopher         text not null         -- e.g. "Jeremy Bentham"
  theme               text not null         -- e.g. "Felicific Calculus"
  presenter_voter_id  uuid references profiles(id) unique  -- one student per topic, one topic per student
  scheduled_for       timestamptz
  presented_at        timestamptz
  art_title           text
  art_explanation     text
  art_image_path      text
  art_uploaded_at     timestamptz
```

The prototype's `topic.work` field is a misnomer — rename to `theme` across the codebase.

### 2. Ranking thumbnails must show real artwork

The prototype's ranking page renders a single tinted letter as the thumbnail (e.g. "P" for Plato). The brief explicitly required real artwork thumbnails — students will recognise topics by their art three weeks later, not by titles.

Implementation:

- **Published topics**: render the uploaded image, transformed to ~80×80 px via Supabase Storage's image transformation API.
- **Presented topics (no art yet)**: fall back to topic order number on a tinted background.
- Apply the same rule to the dashboard cards and the topic detail breadcrumb thumbnail.

### 3. Drag-to-rank must use a touch-capable library

The prototype uses HTML5 native drag-and-drop, which doesn't work on touch devices. Mobile-first was a brief requirement. Production must use **`@dnd-kit/core`** + **`@dnd-kit/sortable`** — touch-capable, accessible, well-maintained. Avoid `react-beautiful-dnd` (deprecated) and `react-dnd` (heavier, less mobile-friendly).

### 4. "My notes" filter logic is wrong

The dashboard's "My notes" chip currently filters topics where `noteCount > 0` (any note from any voter). It should filter topics where the **current voter** has authored at least one note. Query shape:

```sql
SELECT topics.*
FROM topics
JOIN notes ON notes.topic_id = topics.id
WHERE notes.voter_id = current_user_id;
```

### 5. Topic-card content shape

Cards currently render "philosopher / work" (e.g. "Plato / The Republic"). The real format is "philosopher / theme" (e.g. "David Hume / Legal Positivism"). Treat the second line as a `theme` field, not a book reference. Italic styling can stay.

---

## Polish items

- **Topic detail page.** Drop the "Take notes" button — it duplicates the textarea immediately below.
- **Landing footer.** Remove the hardcoded "Beadles: Lim, Cruz" — pull from data or omit.
- **Microcopy.** The landing tagline "Agora is the gallery you build together — and the ballot you settle it with" is the only line that drifts toward purple. Tighten or replace.
- **Submit ballot modal.** The amber-tinted lock warning is slightly intense. Use a muted neutral note instead.
- **Results page.** Redistribution arrows on the IRV timeline could be more visual — consider a small horizontal connector showing where votes flowed per round. Defer if time-bound.

---

## Things to defer (not redesign)

- Mock IRV math (60/40 redistribution split) is placeholder. Real algorithm comes from `specs/irv-spec.md`.
- The "I clicked the link · Continue" affordance on the sign-in screen is prototype-only. Supabase magic links handle this in production.
- `ArtPlaceholder` SVG (lines + circles on tinted ground) is a stylised stand-in. Production renders real uploaded images.
- The hardcoded `ME` voter object replaces with auth context.

---

## Things confirmed in design (don't change)

- Palette, typography, spacing, motion timing, shadow treatment.
- Topic-card states (4 variants render correctly).
- Dashboard layout, status banner variants, filter chips.
- Topic detail layout with private/class notes tabs.
- Admin queue and topics management tables.
- Sequential IRV results layout (5 tabs, vertical round timeline, per-run podium).
- Switch component for note visibility.
- Modal patterns (submit confirmation, lock confirmation).

---

## Syllabus notes

The original syllabus had several typos. These are normalised in the seed data and should be normalised the same way in production:

- "Freidrich" → **Friedrich** (Savigny)
- "Voltgeist" → **Volksgeist**
- "Durkeim" → **Durkheim**
- "socio-logical" → **sociological**
- "Mangeira" → **Mangabeira** (Roberto Unger, topics 10 and 20 — same person, normalised to "Roberto Mangabeira Unger" in both)
- "Mcdougal" → **McDougal**
- "Bobbit" → **Bobbitt**
