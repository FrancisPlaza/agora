-- 0001_initial_schema.sql
-- Tables, enums, constraints, indexes per specs/schema.md.

-- ── Enums ──────────────────────────────────────────────────────────────────

create type profile_status as enum (
  'pending_email',
  'pending_approval',
  'approved',
  'rejected'
);

create type note_visibility as enum ('private', 'class');

-- ── Tables ─────────────────────────────────────────────────────────────────

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

create index profiles_status_idx   on profiles(status) where status in ('pending_approval', 'pending_email');
create index profiles_is_admin_idx on profiles(is_admin) where is_admin = true;

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

create index topics_presenter_idx on topics(presenter_voter_id);
create index topics_order_idx     on topics(order_num);

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

create table ballots (
  id            uuid primary key default gen_random_uuid(),
  voter_id      uuid not null unique references profiles(id) on delete cascade,
  submitted_at  timestamptz,
  locked_at     timestamptz,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index ballots_submitted_idx on ballots(submitted_at) where submitted_at is not null;

create table rankings (
  ballot_id  uuid not null references ballots(id) on delete cascade,
  topic_id   integer not null references topics(id),
  rank       integer not null check (rank > 0),
  created_at timestamptz not null default now(),
  primary key (ballot_id, topic_id),
  unique (ballot_id, rank)
);

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

-- Singleton row
insert into voting_state (id) values (1);

create table tally_results (
  run_num         integer primary key check (run_num between 1 and 5),
  winner_topic_id integer references topics(id),
  rounds          jsonb not null,
  total_ballots   integer not null,
  exhausted       integer not null default 0,
  created_at      timestamptz not null default now()
);

create table audit_log (
  id          uuid primary key default gen_random_uuid(),
  actor_id    uuid not null references profiles(id),
  action      text not null,
  target_type text not null,
  target_id   text,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);

create index audit_log_recent_idx on audit_log(created_at desc);
create index audit_log_actor_idx  on audit_log(actor_id, created_at desc);
