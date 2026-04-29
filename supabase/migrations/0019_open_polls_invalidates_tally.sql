-- 0019_open_polls_invalidates_tally.sql
--
-- Bug: after running the tally, reopening polls left voting_state.tally_run_at
-- and tally_results rows intact. The dashboard banner and /results page key
-- off those signals, so voters saw "Results are in" while voting was active
-- again. The state machine permitted two contradictory truths at once.
--
-- Two fixes:
--
-- 1. open_polls() now clears tally_run_at AND deletes tally_results in the
--    same transaction as the polls-state flip. The semantic is: a tally is
--    valid only between run_tally() and the next open_polls(). No third
--    "discard tally" action exists or is needed.
--
-- 2. write_tally_results() gains a defense-in-depth polls gate. The admin
--    UI already disables Run-tally until polls are locked; this is the
--    direct-RPC backstop. Mirrors 0015's polls gate on submit_ballot.
--
-- The audit-log payload for open_polls also changes: 'open_at' becomes
-- 'opened_at' and a new 'tally_invalidated' boolean is added so the audit
-- timeline can show whether the reopen actually invalidated cached
-- results or was a no-op. Schema unchanged (audit_log.meta is jsonb).

-- ── open_polls ──────────────────────────────────────────────────────
create or replace function public.open_polls(p_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid             uuid := auth.uid();
  v_at              timestamptz := coalesce(p_at, now());
  v_tally_was_set   boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  -- Serialise concurrent admin invocations (mirrors lock_ballots).
  perform 1 from voting_state where id = 1 for update;

  -- Capture pre-update tally state for the audit meta.
  select tally_run_at is not null
    into v_tally_was_set
    from voting_state where id = 1;

  -- Reopen polls AND invalidate the cached tally in the same
  -- transaction. The dashboard banner and /results page both key off
  -- voting_state.tally_run_at and tally_results being non-empty;
  -- without this clear, voters see stale results while voting is
  -- active again.
  update voting_state
     set polls_open_at   = v_at,
         polls_locked    = false,
         polls_locked_at = null,
         polls_locked_by = null,
         tally_run_at    = null
   where id = 1;

  -- WHERE clause is required by the same Supabase REST safety check
  -- that 0016 worked around. run_num is constrained to 1..5, so this
  -- still matches every row.
  delete from tally_results where run_num between 1 and 5;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'open_polls', 'system', null,
    jsonb_build_object(
      'opened_at', v_at,
      'tally_invalidated', v_tally_was_set
    )
  );
end;
$$;

grant execute on function public.open_polls(timestamptz) to authenticated;

-- ── write_tally_results ─────────────────────────────────────────────
create or replace function public.write_tally_results(
  p_results        jsonb,
  p_total_ballots  int
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid           uuid := auth.uid();
  v_winners       jsonb;
  v_polls_locked  boolean;
  v_deadline      timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1 from profiles
    where id = v_uid and status = 'approved' and is_admin
  ) then
    raise exception 'ADMIN_REQUIRED';
  end if;

  -- Defense-in-depth polls gate (0019). Refuse to compute / cache a
  -- tally over an open poll. The admin UI already disables the
  -- Run-tally button until polls are locked; this is the direct-RPC
  -- backstop. Mirrors 0015's shape on submit_ballot. A passed
  -- deadline still permits the tally even if the admin hasn't pressed
  -- Lock, matching how submit_ballot treats deadline-passed as closed.
  select polls_locked, deadline_at
    into v_polls_locked, v_deadline
    from voting_state where id = 1;

  if not v_polls_locked
     and (v_deadline is null or now() < v_deadline) then
    raise exception 'POLLS_NOT_LOCKED';
  end if;

  -- Serialise concurrent admin invocations.
  perform 1 from voting_state where id = 1 for update;

  delete from tally_results where run_num between 1 and 5;

  insert into tally_results
    (run_num, winner_topic_id, rounds, total_ballots, exhausted)
  select
    (entry->>'run_num')::int,
    nullif(entry->>'winner_topic_id', '')::int,
    entry->'rounds',
    p_total_ballots,
    coalesce((entry->>'exhausted')::int, 0)
  from jsonb_array_elements(p_results) as entry;

  update voting_state set tally_run_at = now() where id = 1;

  select coalesce(jsonb_agg(entry->'winner_topic_id'), '[]'::jsonb)
    into v_winners
    from jsonb_array_elements(p_results) as entry;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid,
    'run_tally',
    'system',
    null,
    jsonb_build_object(
      'total_ballots', p_total_ballots,
      'winners', v_winners
    )
  );
end;
$$;

grant execute on function public.write_tally_results(jsonb, int) to authenticated;
