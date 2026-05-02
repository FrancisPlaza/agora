-- 0026_voter_delete_fks.sql
-- Allow profile deletion by relaxing FK references that currently
-- block it. The deleteVoter admin action (lib/actions/admin.ts) calls
-- auth.admin.deleteUser, which cascades to profiles via auth.users →
-- profiles. The remaining tables that reference profiles need to drop
-- their NO ACTION default and accept the deletion gracefully.
--
-- Audit history survives via SET NULL on actor_id; the action and
-- target metadata in the audit_log row remain intact even after the
-- actor's profile is gone.
--
-- Tables already cascading correctly (per 0001):
--   notes.voter_id              → cascade delete
--   ballots.voter_id            → cascade delete
--   rankings.ballot_id          → cascade via ballots
--   topics.presenter_voter_id   → set null
--
-- Constraint names follow the Postgres default `<table>_<column>_fkey`
-- because 0001 doesn't name them explicitly.

-- audit_log.actor_id: was NOT NULL, no on-delete action.
alter table audit_log
  alter column actor_id drop not null;

alter table audit_log
  drop constraint audit_log_actor_id_fkey,
  add  constraint audit_log_actor_id_fkey
    foreign key (actor_id) references profiles(id) on delete set null;

-- profiles.approved_by and profiles.rejected_by: already nullable.
alter table profiles
  drop constraint profiles_approved_by_fkey,
  add  constraint profiles_approved_by_fkey
    foreign key (approved_by) references profiles(id) on delete set null;

alter table profiles
  drop constraint profiles_rejected_by_fkey,
  add  constraint profiles_rejected_by_fkey
    foreign key (rejected_by) references profiles(id) on delete set null;

-- voting_state.polls_locked_by: already nullable.
alter table voting_state
  drop constraint voting_state_polls_locked_by_fkey,
  add  constraint voting_state_polls_locked_by_fkey
    foreign key (polls_locked_by) references profiles(id) on delete set null;
