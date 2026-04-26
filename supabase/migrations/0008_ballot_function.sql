-- 0008_ballot_function.sql
-- Atomic submit_ballot: replaces the multi-call delete-then-insert path in
-- lib/actions/ballot.ts. Runs as security definer so it can write to
-- audit_log (authenticated has no direct write access there).

create or replace function public.submit_ballot(p_rankings jsonb)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid             uuid := auth.uid();
  v_ballot_id       uuid;
  v_submitted_at    timestamptz;
  v_locked_at       timestamptz;
  v_count           int;
  v_distinct_ranks  int;
  v_distinct_topics int;
  v_valid_topics    int;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  if not exists (
    select 1 from profiles
    where id = v_uid and status = 'approved'
  ) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  if not exists (
    select 1 from topics where presenter_voter_id = v_uid
  ) then
    raise exception 'NOT_ELIGIBLE';
  end if;

  if p_rankings is null or jsonb_typeof(p_rankings) <> 'array' then
    raise exception 'INVALID_RANKINGS';
  end if;

  v_count := jsonb_array_length(p_rankings);
  if v_count = 0 then
    raise exception 'EMPTY_BALLOT';
  end if;

  with elems as (
    select
      (elem->>'topicId')::int as topic_id,
      (elem->>'rank')::int    as rank
    from jsonb_array_elements(p_rankings) as elem
  )
  select
    count(distinct rank),
    count(distinct topic_id),
    (select count(*) from topics t where t.id in (select topic_id from elems))
  into v_distinct_ranks, v_distinct_topics, v_valid_topics
  from elems;

  if v_distinct_ranks <> v_count then
    raise exception 'DUPLICATE_RANK';
  end if;

  if v_distinct_topics <> v_count then
    raise exception 'DUPLICATE_TOPIC';
  end if;

  if v_valid_topics <> v_distinct_topics then
    raise exception 'INVALID_TOPIC';
  end if;

  -- Get-or-create the caller's ballot, then lock the row to serialise
  -- concurrent submits from the same user (e.g. double-click).
  insert into ballots (voter_id) values (v_uid)
  on conflict (voter_id) do nothing;

  select id, submitted_at, locked_at
    into v_ballot_id, v_submitted_at, v_locked_at
    from ballots
   where voter_id = v_uid
   for update;

  if v_submitted_at is not null or v_locked_at is not null then
    raise exception 'BALLOT_LOCKED';
  end if;

  delete from rankings where ballot_id = v_ballot_id;

  insert into rankings (ballot_id, topic_id, rank)
  select
    v_ballot_id,
    (elem->>'topicId')::int,
    (elem->>'rank')::int
  from jsonb_array_elements(p_rankings) as elem;

  update ballots set submitted_at = now() where id = v_ballot_id;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid,
    'submit_ballot',
    'voter',
    v_uid::text,
    jsonb_build_object('ranking_count', v_count)
  );
end;
$$;

grant execute on function public.submit_ballot(jsonb) to authenticated;
