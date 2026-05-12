-- 0029_lock_ballots_auto_submit.sql
-- (Originally drafted as 0028 but bumped to 0029 because slot 0028
-- was burnt by an earlier-reverted presentations_bucket_public
-- migration that did apply to prod before the revert. The CLI keys
-- migrations by their numeric prefix in schema_migrations, so a
-- same-numbered new file was silently skipped on the next push.)
--
-- Policy change: when polls lock, non-empty drafts are promoted to
-- submitted ballots so they count in the tally. Previously a forgotten
-- draft simply got force-locked (locked_at set, submitted_at null) and
-- was excluded from the IRV count. Students who set up rankings but
-- forgot to hit Submit before the close had their preferences thrown
-- away — that's the behaviour the class wants to change.
--
-- A draft is safe to auto-submit without re-validating because
-- save_draft_rankings (migration 0025) already enforces every check
-- submit_ballot would: no duplicate ranks, no duplicate topics, no
-- unassigned topics. So any rankings row attached to a draft is a
-- valid IRV preference by construction.
--
-- Empty drafts (no rankings) stay un-submitted — they'd fail
-- submit_ballot's EMPTY_BALLOT gate, and a blank vote isn't a vote.
-- They still get force-locked so the voter can't edit post-close.

create or replace function public.lock_ballots()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid               uuid := auth.uid();
  v_auto_submitted    int  := 0;
  v_force_locked      int  := 0;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  -- Serialise concurrent admin invocations.
  perform 1 from voting_state where id = 1 for update;

  update voting_state
     set polls_locked    = true,
         polls_locked_at = now(),
         polls_locked_by = v_uid
   where id = 1;

  -- Non-empty drafts → auto-submit + lock. Both timestamps set to the
  -- same `now()` for consistency in the audit trail.
  with auto_submitted as (
    update ballots
       set submitted_at = now(),
           locked_at    = now()
     where submitted_at is null
       and locked_at is null
       and exists (select 1 from rankings r where r.ballot_id = ballots.id)
    returning 1
  )
  select count(*) into v_auto_submitted from auto_submitted;

  -- Empty drafts → force-lock only. Excluded from the tally by virtue
  -- of having no rankings (and submitted_at still null).
  with force_locked as (
    update ballots
       set locked_at = now()
     where submitted_at is null
       and locked_at is null
    returning 1
  )
  select count(*) into v_force_locked from force_locked;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'lock_ballots', 'system', null,
    jsonb_build_object(
      'auto_submitted', v_auto_submitted,
      'force_locked_empty', v_force_locked,
      -- Kept for backward compat with any tooling that reads the
      -- pre-0029 shape. Equals auto_submitted + force_locked_empty.
      'ballots_locked', v_auto_submitted + v_force_locked
    )
  );
end;
$$;

grant execute on function public.lock_ballots() to authenticated;

-- Backfill: if lock_ballots() has ever run before this migration,
-- there may be drafts sitting at submitted_at IS NULL, locked_at IS
-- NOT NULL with valid rankings. Bring them into the tally.
-- Idempotent: rerunning matches no rows once submitted_at is set.
update ballots
   set submitted_at = locked_at
 where submitted_at is null
   and locked_at is not null
   and exists (select 1 from rankings r where r.ballot_id = ballots.id);
