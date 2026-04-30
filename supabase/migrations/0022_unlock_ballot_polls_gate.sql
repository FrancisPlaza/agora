-- 0022_unlock_ballot_polls_gate.sql
--
-- Defense-in-depth: refuse per-voter unlock_ballot once ballots are
-- committed. Phase 6 introduced unlock_ballot for "genuine error"
-- recovery — a voter pressed submit and only then noticed they had
-- the wrong ranking. That use case is valid only while polls are
-- open. Once polls lock (or a tally caches), per-voter unlocking
-- creates two problems:
--
-- 1. Inconsistency. The beadle's lock_ballots() force-locked every
--    unsubmitted draft. Unlocking ONE voter's ballot lets them edit
--    while everyone else is frozen — it's not the recovery flow,
--    it's a privilege.
--
-- 2. Tally divergence. After write_tally_results runs, the IRV
--    computation has read every submitted ballot. Unlocking one
--    voter's ballot means their stored preferences are no longer
--    "the ones counted in the tally" — but the tally has already
--    been written. The result silently no longer matches the votes.
--
-- The recovery flow is open_polls (which clears polls_locked AND
-- tally_run_at per 0019), then per-voter unlock. That's exactly what
-- reopenPollsAndUnlockDrafts (Phase 7.5) does — and the new gate
-- doesn't break it because by the time the per-voter unlock_ballot
-- calls fire inside the wrapper, open_polls has already cleared
-- the gate's preconditions.
--
-- Mirrors the shape of 0021's polls gate on assign_topic. Same
-- POLLS_LOCKED error code; same generalised user-facing message.

create or replace function public.unlock_ballot(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid           uuid := auth.uid();
  v_polls_locked  boolean;
  v_deadline      timestamptz;
  v_tally_run     timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  -- Polls gate (added in 0022). See header comment.
  select polls_locked, deadline_at, tally_run_at
    into v_polls_locked, v_deadline, v_tally_run
    from voting_state where id = 1;

  if v_polls_locked
     or (v_deadline is not null and now() >= v_deadline)
     or v_tally_run is not null then
    raise exception 'POLLS_LOCKED';
  end if;

  if not exists (select 1 from ballots where voter_id = p_target) then
    raise exception 'NO_BALLOT';
  end if;

  update ballots
     set submitted_at = null,
         locked_at    = null
   where voter_id = p_target;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (v_uid, 'unlock_ballot', 'voter', p_target::text, '{}'::jsonb);
end;
$$;

grant execute on function public.unlock_ballot(uuid) to authenticated;
