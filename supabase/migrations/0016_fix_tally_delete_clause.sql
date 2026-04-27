-- 0016_fix_tally_delete_clause.sql
-- Fix latent bug in 0009's write_tally_results — `delete from tally_results;`
-- (no WHERE) trips the Supabase REST safety check that requires DELETE /
-- UPDATE statements to carry a predicate. Phase 1.5 never exercised the
-- end-to-end runTally path against a real ballot; Phase 6 wired the
-- 'Run tally' button and surfaced the error: "DELETE requires a WHERE
-- clause".
--
-- Fix: add a trivial WHERE that's always true. Semantics unchanged —
-- `run_num` is constrained to 1..5 by 0001's check constraint, so the
-- predicate matches every row. Equivalent to TRUNCATE for our purposes
-- but stays inside the same `security definer` privilege envelope.

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
  v_uid     uuid := auth.uid();
  v_winners jsonb;
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
