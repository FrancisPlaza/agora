-- 0025_reject_unassigned_in_ranking.sql
-- Reject ballots and drafts that include topics with no assigned
-- presenter. Topics in the `unassigned` state (presenter_voter_id IS
-- NULL) appear in the dashboard gallery but can't be voted on — there's
-- no presentation to rank.
--
-- Single-line behaviour change in each function: the v_valid_topics
-- subquery now also requires t.presenter_voter_id IS NOT NULL. An
-- unassigned topic_id raises the existing INVALID_TOPIC exception, so
-- no action-layer error handling needs to change.
--
-- The full function bodies are reproduced below to preserve the
-- authoritative state from 0008/0013/0015. Migrations are append-only
-- per CLAUDE.md; redefinition via `create or replace` is the canonical
-- pattern.

create or replace function public.save_draft_rankings(p_rankings jsonb)
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

  if v_count > 0 then
    with elems as (
      select
        (elem->>'topicId')::int as topic_id,
        (elem->>'rank')::int    as rank
      from jsonb_array_elements(p_rankings) as elem
    )
    select
      count(distinct rank),
      count(distinct topic_id),
      (
        select count(*)
          from topics t
         where t.id in (select topic_id from elems)
           and t.presenter_voter_id is not null
      )
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
  end if;

  -- Get-or-create the caller's ballot, then lock the row to serialise
  -- concurrent same-user saves.
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

  if v_count > 0 then
    insert into rankings (ballot_id, topic_id, rank)
    select
      v_ballot_id,
      (elem->>'topicId')::int,
      (elem->>'rank')::int
    from jsonb_array_elements(p_rankings) as elem;
  end if;
end;
$$;

grant execute on function public.save_draft_rankings(jsonb) to authenticated;


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
  v_polls_locked    boolean;
  v_deadline        timestamptz;
  v_open_at         timestamptz;
begin
  if v_uid is null then
    raise exception 'NOT_AUTHENTICATED';
  end if;

  -- Polls gate (from 0015). Runs before eligibility checks so a
  -- locked-poll error reads cleanly even for users without an assigned
  -- topic.
  select polls_locked, deadline_at, polls_open_at
    into v_polls_locked, v_deadline, v_open_at
    from voting_state where id = 1;

  if v_polls_locked
     or (v_deadline is not null and now() >= v_deadline) then
    raise exception 'POLLS_CLOSED';
  end if;
  if v_open_at is null or now() < v_open_at then
    raise exception 'POLLS_NOT_OPEN';
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
    (
      select count(*)
        from topics t
       where t.id in (select topic_id from elems)
         and t.presenter_voter_id is not null
    )
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
