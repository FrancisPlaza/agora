-- 0009_tally_function.sql
-- Atomic write_tally_results: replaces the loop-of-inserts in
-- lib/actions/tally.ts. The IRV algorithm itself stays in TypeScript;
-- this function only handles the writes (delete cached results, insert
-- new ones, bump voting_state, audit log) inside a single transaction.
--
-- Concurrent admin invocations serialise via FOR UPDATE on the
-- voting_state singleton row.

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

  delete from tally_results;

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
