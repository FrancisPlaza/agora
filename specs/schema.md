# Agora — Supabase Schema Specification

Postgres schema, RLS policies, triggers, storage. Authoritative for Phase 1 build. Implement as append-only migrations under `db/migrations/`.

---

## Design principles

1. **Topic state is derived**, not stored. Compute `unassigned | assigned | presented | published` from which fields are populated.
2. **Ballot secrecy is enforced by RLS**, not application code. A beadle calling `SELECT * FROM rankings` directly should get back nothing.
3. **Tally runs as `service_role`**, bypasses RLS, returns aggregates only. The function never exposes individual ballots.
4. **Migrations append only.** Never edit a committed migration.
5. **Soft delete is not used.** When a beadle reassigns a topic, we update the row. When a registration is rejected, we keep the row with `status = 'rejected'`. No row is ever deleted by application code.

---

## Tables

### `profiles`

Mirrors `auth.users` 1:1 (FK on `id`). Auto-created via trigger on `auth.users INSERT`.

```sql
create type profile_status as enum (
  'pending_email',
  'pending_approval',
  'approved',
  'rejected'
);

create table profiles (
  id                uuid primary key references auth.users on delete cascade,
  email             text not null unique,
  full_name         text not null,
  student_id        text not null unique,
  status            profile_status not null default 'pending_email',
  is_admin          boolean not null default false,
  approved_at       timestamptz,
  approved_by       uuid references profiles(id),
  rejected_at       timestamptz,
  rejected_by       uuid references profiles(id),
  rejection_reason  text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index profiles_status_idx     on profiles(status) where status in ('pending_approval', 'pending_email');
create index profiles_is_admin_idx   on profiles(is_admin) where is_admin = true;
```

Status transitions:

- New `auth.users` row → `profiles.status = 'pending_email'`.
- After `auth.users.email_confirmed_at` is set → `status = 'pending_approval'` (via trigger).
- Beadle approves → `status = 'approved'`, `approved_at`, `approved_by` set.
- Beadle rejects → `status = 'rejected'`, `rejected_at`, `rejected_by`, `rejection_reason` set.

### `topics`

The 32 syllabus entries. Seeded once via migration; never inserted/deleted at runtime.

```sql
create table topics (
  id                  integer primary key,
  order_num           integer not null unique check (order_num between 1 and 32),
  philosopher         text not null,
  theme               text not null,
  presenter_voter_id  uuid unique references profiles(id) on delete set null,
  scheduled_for       timestamptz,
  presented_at        timestamptz,
  art_title           text,
  art_explanation     text,
  art_image_path      text,
  art_uploaded_at     timestamptz,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),

  -- a presenter assignment requires the FK; presented requires assigned;
  -- published requires presented + art fields populated
  constraint presented_requires_presenter
    check (presented_at is null or presenter_voter_id is not null),
  constraint published_requires_presented
    check (art_uploaded_at is null or presented_at is not null),
  constraint published_requires_all_art
    check (
      art_uploaded_at is null or (
        art_title is not null and
        art_explanation is not null and
        art_image_path is not null
      )
    )
);

create index topics_presenter_idx   on topics(presenter_voter_id);
create index topics_order_idx       on topics(order_num);
```

### `notes`

One per voter per topic. Editable forever.

```sql
create type note_visibility as enum ('private', 'class');

create table notes (
  id          uuid primary key default gen_random_uuid(),
  voter_id    uuid not null references profiles(id) on delete cascade,
  topic_id    integer not null references topics(id),
  body        text not null default '',
  visibility  note_visibility not null default 'private',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (voter_id, topic_id)
);

create index notes_topic_class_idx on notes(topic_id) where visibility = 'class';
create index notes_voter_idx       on notes(voter_id);
```

### `ballots`

One per voter. Created lazily on first ranking action.

**Voting eligibility rule:** "If you are presenting, you are voting. Otherwise, you are not voting." Voting eligibility = `status = 'approved' AND exists topic where presenter_voter_id = profiles.id`. Non-voting users (e.g. the professor approved as a non-voting admin) cannot create a ballot. Enforced via RLS `WITH CHECK` on insert/update.

```sql
create table ballots (
  id            uuid primary key default gen_random_uuid(),
  voter_id      uuid not null unique references profiles(id) on delete cascade,
  submitted_at  timestamptz,           -- set when voter submits → locked
  locked_at     timestamptz,           -- set when admin force-locks pre-deadline
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index ballots_submitted_idx on ballots(submitted_at) where submitted_at is not null;
```

A ballot is "locked" if `submitted_at IS NOT NULL OR locked_at IS NOT NULL`. Once locked, no further `rankings` mutations. Beadles can call `unlock_ballot()` to reset both fields to null, allowing the voter to edit and resubmit. Existing rankings are preserved through unlock.

### `rankings`

The actual ranking — the secrecy boundary. A beadle must NOT be able to read this table for ballots other than their own.

```sql
create table rankings (
  ballot_id  uuid not null references ballots(id) on delete cascade,
  topic_id   integer not null references topics(id),
  rank       integer not null check (rank > 0),
  created_at timestamptz not null default now(),
  primary key (ballot_id, topic_id),
  unique (ballot_id, rank)
);
```

Partial rankings allowed: a ballot may have any number of rows from 0 to 32.

### `voting_state`

Singleton config row.

```sql
create table voting_state (
  id              integer primary key default 1 check (id = 1),
  deadline_at     timestamptz,
  polls_open_at   timestamptz,
  polls_locked    boolean not null default false,
  polls_locked_at timestamptz,
  polls_locked_by uuid references profiles(id),
  tally_run_at    timestamptz,
  updated_at      timestamptz not null default now()
);

insert into voting_state (id) values (1);
```

`polls_open_at` is the moment the "Submit final ballot" button enables. Either the beadle sets it manually, or it's auto-derived from a separate "polls open" timestamp. For v1, use `deadline_at` as both signal: drafts allowed anytime, submission opens when beadle decides (sets `polls_open_at`), all locked at `deadline_at` or when `polls_locked = true`.

### `tally_results`

Cached output of `run_tally()`. One row per IRV run (1..5).

```sql
create table tally_results (
  run_num         integer primary key check (run_num between 1 and 5),
  winner_topic_id integer references topics(id),    -- null if run failed (no preferences)
  rounds          jsonb not null,                   -- full round-by-round display data
  total_ballots   integer not null,
  exhausted       integer not null default 0,
  created_at      timestamptz not null default now()
);
```

### `audit_log`

Append-only record of admin actions.

```sql
create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references profiles(id),
  action      text not null,    -- 'approve_voter' | 'approve_non_voter' | 'reject_voter' | 'assign_topic' | 'reassign_topic' | 'mark_presented' | 'lock_ballots' | 'unlock_ballot' | 'run_tally' | 'set_deadline'
  target_type text not null,    -- 'voter' | 'topic' | 'system'
  target_id   text,             -- voter uuid or topic id, as text
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_log_recent_idx on audit_log(created_at desc);
create index audit_log_actor_idx  on audit_log(actor_id, created_at desc);
```

`INSERT` only via server-side service_role calls. Never updated, never deleted.

---

## Triggers

### Auto-create `profiles` on `auth.users` insert

```sql
create function handle_new_user() returns trigger language plpgsql security definer as $$
begin
  insert into profiles (id, email, full_name, student_id, status)
  values (new.id, new.email,
          coalesce(new.raw_user_meta_data->>'full_name', ''),
          coalesce(new.raw_user_meta_data->>'student_id', ''),
          'pending_email');
  return new;
end $$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();
```

### Promote to `pending_approval` on email confirmation

```sql
create function handle_email_confirmed() returns trigger language plpgsql security definer as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles set status = 'pending_approval' where id = new.id;
  end if;
  return new;
end $$;

create trigger on_email_confirmed
  after update on auth.users
  for each row execute function handle_email_confirmed();
```

### `updated_at` auto-bump

Generic trigger applied to `profiles`, `topics`, `notes`, `ballots`, `voting_state`.

```sql
create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;
```

---

## RLS policies

Enable RLS on every table:

```sql
alter table profiles      enable row level security;
alter table topics        enable row level security;
alter table notes         enable row level security;
alter table ballots       enable row level security;
alter table rankings      enable row level security;
alter table voting_state  enable row level security;
alter table tally_results enable row level security;
alter table audit_log     enable row level security;
```

Helper functions:

```sql
create function is_approved() returns boolean language sql stable as $$
  select coalesce((select status = 'approved' from profiles where id = auth.uid()), false);
$$;

create function is_admin() returns boolean language sql stable as $$
  select coalesce((select is_admin and status = 'approved' from profiles where id = auth.uid()), false);
$$;
```

### `profiles`

```sql
-- read your own row, regardless of status
create policy profiles_self_read on profiles
  for select using (id = auth.uid());

-- approved voters can read minimal info on other approved voters
-- (name, status — for class notes attribution and admin UI)
create policy profiles_approved_read_others on profiles
  for select using (is_approved() and status = 'approved');

-- admins can read every profile (for approval queue, voters table)
create policy profiles_admin_read_all on profiles
  for select using (is_admin());

-- update your own name only; status and is_admin stay locked
create policy profiles_self_update on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());
-- enforce field-level limits via column-level grants OR via a check function;
-- the simpler route: only expose name updates through a server action that
-- writes through service_role and validates the diff.

-- admins can update status and assign topics indirectly (not is_admin)
create policy profiles_admin_update on profiles
  for update using (is_admin());
```

### `topics`

```sql
-- approved voters can read all topic data
create policy topics_approved_read on topics
  for select using (is_approved());

-- presenter can update art fields when their topic is in 'presented' state
create policy topics_presenter_update_art on topics
  for update using (
    presenter_voter_id = auth.uid()
    and presented_at is not null
  ) with check (
    presenter_voter_id = auth.uid()
    -- (column-level write restrictions enforced at server-action level)
  );

-- admins update presenter assignment, presented_at
create policy topics_admin_update on topics
  for update using (is_admin());
```

### `notes`

```sql
-- read your own
create policy notes_self_read on notes
  for select using (voter_id = auth.uid());

-- read others' shared notes (class visibility)
create policy notes_class_read on notes
  for select using (is_approved() and visibility = 'class');

-- write your own
create policy notes_self_write on notes
  for all using (voter_id = auth.uid())
  with check (voter_id = auth.uid());
```

Admins have **no** special read access to private notes. Note the absence of a `notes_admin_read` policy.

### `ballots` (the secrecy boundary)

```sql
-- voter sees their own full ballot row
create policy ballots_self_read on ballots
  for select using (voter_id = auth.uid());

-- voter creates / updates their own ballot — only if they are a presenter
create policy ballots_self_write on ballots
  for all using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from topics where presenter_voter_id = auth.uid())
  );

-- admins see only voter_id and submitted_at and locked_at,
-- NOT the rankings — but RLS is row-level not column-level,
-- so we can't restrict columns here directly. Two approaches:
-- (a) Create a view ballots_admin_view that selects only the
--     allowed columns, and grant SELECT on the view to authenticated.
-- (b) Use a server action that reads via service_role and projects.
-- We use (a). The view bypasses the rankings table entirely.

create view ballots_admin_view as
  select id, voter_id, submitted_at, locked_at, created_at, updated_at
  from ballots;

grant select on ballots_admin_view to authenticated;

-- separate policy on the view via security_invoker
alter view ballots_admin_view set (security_invoker = on);

create policy ballots_admin_view_read on ballots
  for select using (is_admin());
-- combined with the view, admins can SELECT * from ballots_admin_view;
-- they cannot SELECT * from rankings (see below).
```

### `rankings` (the secrecy boundary, continued)

```sql
-- voter reads only their own rankings, via their own ballot
create policy rankings_self_read on rankings
  for select using (
    ballot_id in (select id from ballots where voter_id = auth.uid())
  );

-- voter writes only their own, only while ballot is unlocked
create policy rankings_self_write on rankings
  for all using (
    ballot_id in (
      select id from ballots
      where voter_id = auth.uid()
        and submitted_at is null
        and locked_at is null
    )
  ) with check (
    ballot_id in (
      select id from ballots
      where voter_id = auth.uid()
        and submitted_at is null
        and locked_at is null
    )
  );

-- NO admin SELECT policy. Admins cannot read rankings.
-- Tally function uses service_role (bypasses RLS) to read for IRV computation.
```

### `voting_state`

```sql
-- everyone approved can read deadline / polls state
create policy voting_state_approved_read on voting_state
  for select using (is_approved());

-- only admins can update
create policy voting_state_admin_write on voting_state
  for update using (is_admin());
```

### `tally_results`

```sql
-- visible to all approved voters once written
create policy tally_results_approved_read on tally_results
  for select using (is_approved());

-- writes only via service_role (no policy exposes write to authenticated)
```

### `audit_log`

```sql
-- admins read
create policy audit_log_admin_read on audit_log
  for select using (is_admin());

-- writes only via service_role
```

---

## Storage

### Bucket: `presentations`

```sql
insert into storage.buckets (id, name, public) values ('presentations', 'presentations', false);
```

Policies:

```sql
-- approved voters can read all presentation files
create policy presentations_read on storage.objects
  for select using (bucket_id = 'presentations' and is_approved());

-- only the assigned presenter can upload, and only when topic is in 'presented' state
create policy presentations_presenter_write on storage.objects
  for insert with check (
    bucket_id = 'presentations'
    and exists (
      select 1 from topics t
      where t.id = (split_part(name, '/', 1))::int
        and t.presenter_voter_id = auth.uid()
        and t.presented_at is not null
    )
  );

-- presenter can delete their own file (e.g. to replace)
create policy presentations_presenter_delete on storage.objects
  for delete using (
    bucket_id = 'presentations'
    and exists (
      select 1 from topics t
      where t.id = (split_part(name, '/', 1))::int
        and t.presenter_voter_id = auth.uid()
    )
  );

-- admins can delete (cleanup / abuse handling)
create policy presentations_admin_delete on storage.objects
  for delete using (bucket_id = 'presentations' and is_admin());
```

Path convention: `{topic_id}/{filename}`. PDF preview generated server-side as `{topic_id}/{filename}.preview.png`.

---

## Seed migration

Topics 1..32 inserted from the canonical syllabus (see `src/data.jsx` for prototype values). Seed migration is idempotent (`ON CONFLICT (id) DO NOTHING`).

Two beadles to seed manually after first deploy by:

```sql
update profiles set is_admin = true where email in ('beadle1@sanbeda.edu.ph', 'beadle2@sanbeda.edu.ph');
```

(Or expose a one-off setup screen guarded by an env-set bootstrap secret. Don't ship admin promotion as a runtime feature.)

---

## Server-side functions

All mutations go through Server Actions or Postgres functions, never raw client `INSERT`/`UPDATE` against sensitive tables.

Required functions:

- `approve_voter(target_id uuid, topic_id integer, is_admin boolean default false)` — sets `profiles.status = 'approved'`, optionally `is_admin`, assigns topic. Audit logged. Service role.
- `approve_non_voter(target_id uuid, is_admin boolean default true)` — sets `profiles.status = 'approved'` without assigning a topic. Used for the professor and other non-voting users. Audit logged.
- `reject_voter(target_id uuid, reason text)` — sets `profiles.status = 'rejected'`, writes audit log.
- `assign_topic(target_id uuid, topic_id integer)` — sets `topics.presenter_voter_id`. Used for reassignment after initial approval.
- `mark_topic_presented(topic_id integer)` — sets `topics.presented_at = now()`, writes audit log.
- `submit_ballot(rankings jsonb)` — validates ranks (no duplicates, all topic_ids valid, voter has assigned topic), writes rankings, sets `ballots.submitted_at`. Returns error if already submitted.
- `unlock_ballot(target_voter_id uuid)` — admin-only. Clears `ballots.submitted_at` and `ballots.locked_at` for the target voter. Existing rankings preserved. Voter must explicitly resubmit. Audit logged.
- `lock_ballots()` — sets `voting_state.polls_locked = true`, sets `locked_at` on all unsubmitted ballots, writes audit log.
- `run_tally()` — runs sequential IRV (see `irv-spec.md`), populates `tally_results`, writes audit log. Idempotent — re-running clears `tally_results` first within a transaction. Confirmed safe to re-run after deadline extension.
- `set_deadline(deadline timestamptz)` — admin-only. Updates `voting_state.deadline_at`. Audit logged.

---

## Resolved decisions

1. **Voting eligibility = "if you are presenting, you are voting".** Voters are profiles with an assigned topic. Non-voting users (e.g. the professor) can be approved as admins without a topic; they have full read access to the gallery and notes but cannot create a ballot. Enforced via the `ballots_self_write` RLS policy and the `submit_ballot` server function.
2. **Self-vote on own topic.** Permitted. The ranking page may show a dimmed "Yours" pill for the user's own topic, but voting is allowed.
3. **Ballot edits after submit.** Voter cannot edit. Beadle can `unlock_ballot()` for genuine errors; voter then edits and resubmits. Audit logged.
4. **Tally re-runs.** `run_tally()` is idempotent and overwrites prior results. Re-running after deadline extension is supported.
