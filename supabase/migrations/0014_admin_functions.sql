-- 0014_admin_functions.sql
-- Eight admin Postgres functions that replace the SQL stand-ins prior
-- phases relied on for testing. Every function:
--   * is `security definer` with `set search_path = public, auth`
--   * gates on `is_admin()` and raises 'ADMIN_REQUIRED' otherwise
--   * writes one `audit_log` row at the end
-- The functions never read or write `rankings` — ballot secrecy is
-- preserved (admins see ballot status, never contents).
--
-- Audit-action naming: `approve_voter` raises `'approve_voter'` when a
-- topic id is supplied, `'approve_non_voter'` when it isn't. The audit
-- log is human-scannable; distinguishing "approved Andrea Reyes for
-- topic 5" from "approved Prof. Cruz as non-voting admin" matches the
-- mental model. Both share the same `target_id` (the approved profile);
-- the action verb is the only signal.

-- ── approve_voter ─────────────────────────────────────────────────────
create or replace function public.approve_voter(
  p_target   uuid,
  p_topic_id int default null,
  p_is_admin boolean default false
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if not exists (select 1 from profiles where id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  if p_topic_id is not null then
    -- Lock the topic row to detect collisions atomically.
    perform 1 from topics where id = p_topic_id for update;
    if exists (
      select 1 from topics
       where id = p_topic_id
         and presenter_voter_id is not null
         and presenter_voter_id <> p_target
    ) then
      raise exception 'TOPIC_TAKEN';
    end if;

    update topics
       set presenter_voter_id = p_target
     where id = p_topic_id;
  end if;

  update profiles
     set status      = 'approved',
         approved_at = now(),
         approved_by = v_uid,
         is_admin    = coalesce(p_is_admin, false)
   where id = p_target;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid,
    case when p_topic_id is null then 'approve_non_voter' else 'approve_voter' end,
    'voter',
    p_target::text,
    case
      when p_topic_id is null then jsonb_build_object('is_admin', p_is_admin)
      else jsonb_build_object('topic_id', p_topic_id, 'is_admin', p_is_admin)
    end
  );
end;
$$;

grant execute on function public.approve_voter(uuid, int, boolean) to authenticated;

-- ── reject_voter ──────────────────────────────────────────────────────
create or replace function public.reject_voter(
  p_target uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;
  if not exists (select 1 from profiles where id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;

  update profiles
     set status           = 'rejected',
         rejected_at      = now(),
         rejected_by      = v_uid,
         rejection_reason = nullif(trim(p_reason), '')
   where id = p_target;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'reject_voter', 'voter', p_target::text,
    jsonb_build_object('reason', p_reason)
  );
end;
$$;

grant execute on function public.reject_voter(uuid, text) to authenticated;

-- ── assign_topic ──────────────────────────────────────────────────────
-- Reassignment clears the topic's art fields (so state derives back to
-- 'assigned') if it was previously published. Storage objects aren't
-- removed here — that's the TS layer's job (best-effort cleanup against
-- the storage API, which the function can't reach).
create or replace function public.assign_topic(
  p_target   uuid,
  p_topic_id int
)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid       uuid := auth.uid();
  v_old_owner uuid;
  v_was_pub   boolean;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if not exists (select 1 from profiles where id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if not exists (select 1 from topics where id = p_topic_id) then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  perform 1 from topics where id = p_topic_id for update;

  select presenter_voter_id, art_uploaded_at is not null
    into v_old_owner, v_was_pub
    from topics where id = p_topic_id;

  -- Releasing the prior assignment by clearing the FK first lets the
  -- target take it (the unique constraint would otherwise block).
  update topics
     set presenter_voter_id = null,
         scheduled_for      = null,
         presented_at       = null,
         art_title          = null,
         art_explanation    = null,
         art_image_path     = null,
         art_uploaded_at    = null
   where id = p_topic_id;

  update topics
     set presenter_voter_id = p_target
   where id = p_topic_id;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid,
    case when v_old_owner is null then 'assign_topic' else 'reassign_topic' end,
    'topic',
    p_topic_id::text,
    jsonb_build_object(
      'from', v_old_owner,
      'to',   p_target,
      'art_cleared', v_was_pub
    )
  );
end;
$$;

grant execute on function public.assign_topic(uuid, int) to authenticated;

-- ── mark_topic_presented ──────────────────────────────────────────────
create or replace function public.mark_topic_presented(p_topic_id int)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid           uuid := auth.uid();
  v_presenter     uuid;
  v_already       timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  select presenter_voter_id, presented_at
    into v_presenter, v_already
    from topics where id = p_topic_id;

  if v_presenter is null then
    raise exception 'INVALID_STATE';  -- not yet assigned
  end if;
  if v_already is not null then
    raise exception 'INVALID_STATE';  -- already presented
  end if;

  update topics set presented_at = now() where id = p_topic_id;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (v_uid, 'mark_presented', 'topic', p_topic_id::text, '{}'::jsonb);
end;
$$;

grant execute on function public.mark_topic_presented(int) to authenticated;

-- ── lock_ballots ──────────────────────────────────────────────────────
create or replace function public.lock_ballots()
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid     uuid := auth.uid();
  v_locked  int;
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

  with force_locked as (
    update ballots
       set locked_at = now()
     where submitted_at is null
       and locked_at is null
    returning 1
  )
  select count(*) into v_locked from force_locked;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'lock_ballots', 'system', null,
    jsonb_build_object('ballots_locked', v_locked)
  );
end;
$$;

grant execute on function public.lock_ballots() to authenticated;

-- ── unlock_ballot ─────────────────────────────────────────────────────
-- Clears submitted_at and locked_at on the target's single ballot.
-- Existing rankings are preserved; the voter can edit and resubmit.
create or replace function public.unlock_ballot(p_target uuid)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

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

-- ── set_deadline ──────────────────────────────────────────────────────
create or replace function public.set_deadline(p_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  update voting_state set deadline_at = p_at where id = 1;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'set_deadline', 'system', null,
    jsonb_build_object('deadline_at', p_at)
  );
end;
$$;

grant execute on function public.set_deadline(timestamptz) to authenticated;

-- ── open_polls ────────────────────────────────────────────────────────
-- Sets polls_open_at and clears any prior lock state. Note: this does
-- NOT reset `locked_at` on individual ballots that were force-locked by
-- a previous lock_ballots() call — those voters need a per-voter
-- unlock_ballot(). Re-opening polls just lets new submissions in; it
-- doesn't retroactively edit individual ballot state.
create or replace function public.open_polls(p_at timestamptz default null)
returns void
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_uid uuid := auth.uid();
  v_at  timestamptz := coalesce(p_at, now());
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  update voting_state
     set polls_open_at   = v_at,
         polls_locked    = false,
         polls_locked_at = null,
         polls_locked_by = null
   where id = 1;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid, 'open_polls', 'system', null,
    jsonb_build_object('open_at', v_at)
  );
end;
$$;

grant execute on function public.open_polls(timestamptz) to authenticated;
