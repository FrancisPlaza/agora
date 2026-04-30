-- 0021_assign_topic_polls_gate.sql
--
-- Defense-in-depth: refuse to reassign a topic once ballots are
-- committed. After polls lock (or a tally has been cached), every
-- voter has cast preferences against a specific topic-to-presenter
-- mapping. Topic 9 is "voter9 presenting Confucianism" in voters'
-- minds; rankings.topic_id alone doesn't carry that. Reassigning
-- topic 9 to voter10 after lock would silently substitute the
-- presenter for committed ballots — voter intent violation.
--
-- The fix adds a polls gate to assign_topic, mirroring 0015's gate on
-- submit_ballot:
--   • polls_locked = true → blocked
--   • deadline passed → blocked (matches derivePollsState semantics)
--   • tally_run_at non-null → blocked (defense-in-depth; in valid
--     state-machine paths this is subsumed by polls_locked, since
--     write_tally_results requires lock and 0019's open_polls clears
--     tally_run_at on reopen — but cheap to assert intent here too)
--
-- Reopening polls automatically un-blocks: open_polls clears
-- polls_locked AND tally_run_at (0019), so the gate clears with no
-- new code needed for the corollary.
--
-- The gate fires BEFORE the no-op short-circuit. A confused admin
-- re-clicking Reassign while polls are locked gets a clear error
-- rather than a silent success. UI prevents reaching this path at
-- all; the function-level gate is the direct-RPC backstop.

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
  v_uid              uuid := auth.uid();
  v_dest_old_owner   uuid;
  v_dest_was_pub     boolean;
  v_source_topic_id  int;
  v_source_was_pub   boolean;
  v_action           text;
  v_polls_locked     boolean;
  v_deadline         timestamptz;
  v_tally_run        timestamptz;
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if not exists (select 1 from profiles where id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if not exists (select 1 from topics where id = p_topic_id) then
    raise exception 'TOPIC_NOT_FOUND';
  end if;

  -- Polls gate (added in 0021). See header comment for why this comes
  -- before the no-op short-circuit.
  select polls_locked, deadline_at, tally_run_at
    into v_polls_locked, v_deadline, v_tally_run
    from voting_state where id = 1;

  if v_polls_locked
     or (v_deadline is not null and now() >= v_deadline)
     or v_tally_run is not null then
    raise exception 'POLLS_LOCKED';
  end if;

  -- No-op short-circuit. Re-clicking Reassign with the same destination
  -- shouldn't error and shouldn't spam the audit log. Returns silently;
  -- the action layer's revalidatePath calls still run downstream.
  if exists (
    select 1 from topics
    where id = p_topic_id and presenter_voter_id = p_target
  ) then
    return;
  end if;

  -- Source guard: if this student has already presented any topic,
  -- they're locked. Mark-presented is a one-way transition; reassigning
  -- away would erase the presentation history.
  if exists (
    select 1 from topics
    where presenter_voter_id = p_target and presented_at is not null
  ) then
    raise exception 'STUDENT_ALREADY_PRESENTED';
  end if;

  -- Target guard: a presented topic can't be yanked from its presenter,
  -- regardless of whether the new target has presented yet.
  if exists (
    select 1 from topics
    where id = p_topic_id and presented_at is not null
  ) then
    raise exception 'TOPIC_ALREADY_PRESENTED';
  end if;

  -- Serialise concurrent admin invocations on this destination row.
  perform 1 from topics where id = p_topic_id for update;

  -- Capture pre-update state for the audit log.
  select presenter_voter_id, art_uploaded_at is not null
    into v_dest_old_owner, v_dest_was_pub
    from topics where id = p_topic_id;

  select id, art_uploaded_at is not null
    into v_source_topic_id, v_source_was_pub
    from topics
    where presenter_voter_id = p_target and id <> p_topic_id;

  -- Release the source. The id <> p_topic_id guard is defensive — the
  -- no-op short-circuit above already excludes the same-topic case.
  -- presented_at stays null by construction (source guard rejected any
  -- presented topic above).
  update topics
     set presenter_voter_id = null,
         scheduled_for      = null,
         art_title          = null,
         art_explanation    = null,
         art_image_path     = null,
         art_uploaded_at    = null
   where presenter_voter_id = p_target and id <> p_topic_id;

  -- Clear destination row. Same field set as source. presented_at left
  -- alone (target guard rejected any presented topic above).
  update topics
     set presenter_voter_id = null,
         scheduled_for      = null,
         art_title          = null,
         art_explanation    = null,
         art_image_path     = null,
         art_uploaded_at    = null
   where id = p_topic_id;

  update topics
     set presenter_voter_id = p_target
   where id = p_topic_id;

  -- 'reassign_topic' covers both reassign-with-source-clear and
  -- destination-with-prior-owner. 'assign_topic' is reserved for the
  -- pure first-time case where neither side had a prior owner.
  if v_dest_old_owner is not null or v_source_topic_id is not null then
    v_action := 'reassign_topic';
  else
    v_action := 'assign_topic';
  end if;

  insert into audit_log (actor_id, action, target_type, target_id, meta)
  values (
    v_uid,
    v_action,
    'topic',
    p_topic_id::text,
    jsonb_build_object(
      'from',               v_dest_old_owner,
      'to',                 p_target,
      'source_topic_id',    v_source_topic_id,
      'art_cleared_source', v_source_was_pub,
      'art_cleared_dest',   v_dest_was_pub
    )
  );
end;
$$;

grant execute on function public.assign_topic(uuid, int) to authenticated;
