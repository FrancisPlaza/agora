-- 0020_assign_topic_guards.sql
--
-- Bug: reassigning a student to a new topic fails with a unique-constraint
-- violation on topics.presenter_voter_id. The original assign_topic from
-- 0014 cleared the destination row but never released the source row, so
-- the student transiently had two rows pointing at them.
--
-- Plus a related policy gap: a student who'd already presented could be
-- reassigned (erasing their work), and a topic with a recorded
-- presentation could be yanked from its presenter.
--
-- This migration replaces assign_topic with a version that:
--   • Releases the student's current topic before assigning the new one.
--   • Refuses to reassign a student who has already presented.
--   • Refuses to reassign a topic that has already been presented.
--   • Short-circuits silently when the target/topic pair is unchanged
--     (no audit-log entry — re-clicking Reassign with the same selection
--     shouldn't spam the timeline).
--
-- Storage cleanup happens in the TS layer (lib/actions/admin.ts) for both
-- prefixes that had art before the swap. The function only handles the
-- row-state transitions in a single transaction.

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
begin
  if v_uid is null then raise exception 'NOT_AUTHENTICATED'; end if;
  if not is_admin() then raise exception 'ADMIN_REQUIRED'; end if;

  if not exists (select 1 from profiles where id = p_target) then
    raise exception 'TARGET_NOT_FOUND';
  end if;
  if not exists (select 1 from topics where id = p_topic_id) then
    raise exception 'TOPIC_NOT_FOUND';
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
