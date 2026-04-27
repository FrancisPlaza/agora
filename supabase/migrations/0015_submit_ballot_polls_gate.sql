-- 0015_submit_ballot_polls_gate.sql
-- Defense-in-depth: submit_ballot from 0008 only checks ballot lock
-- state, not polls state. The UI shields it (the submit CTA only
-- appears when polls are open, and lock_ballots flips locked_at on
-- every unsubmitted ballot anyway), but the function itself was
-- unguarded against direct RPC calls. This migration adds two checks
-- at the top of submit_ballot — POLLS_CLOSED if locked or past
-- deadline, POLLS_NOT_OPEN if not yet opened. The rest of the function
-- is unchanged from 0008.
--
-- save_draft_rankings is intentionally NOT gated this way: drafts are
-- allowed before polls open, and after lock_ballots() runs the
-- existing BALLOT_LOCKED path catches the post-lock case.

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

  -- Polls gate (added in 0015). Runs before eligibility checks so a
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
