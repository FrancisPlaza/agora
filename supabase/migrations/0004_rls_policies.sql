-- 0004_rls_policies.sql
-- Row-level security on every table. Pay special attention to the
-- rankings/ballots secrecy boundary: admins must NOT read individual rankings.

-- ── Enable RLS ────────────────────────────────────────────────────────────

alter table profiles      enable row level security;
alter table topics        enable row level security;
alter table notes         enable row level security;
alter table ballots       enable row level security;
alter table rankings      enable row level security;
alter table voting_state  enable row level security;
alter table tally_results enable row level security;
alter table audit_log     enable row level security;

-- ── profiles ──────────────────────────────────────────────────────────────

create policy profiles_self_read on profiles
  for select using (id = auth.uid());

create policy profiles_approved_read_others on profiles
  for select using (is_approved() and status = 'approved');

create policy profiles_admin_read_all on profiles
  for select using (is_admin());

create policy profiles_self_update on profiles
  for update using (id = auth.uid())
  with check (id = auth.uid());

create policy profiles_admin_update on profiles
  for update using (is_admin());

-- ── topics ────────────────────────────────────────────────────────────────

create policy topics_approved_read on topics
  for select using (is_approved());

create policy topics_presenter_update_art on topics
  for update using (
    presenter_voter_id = auth.uid()
    and presented_at is not null
  ) with check (
    presenter_voter_id = auth.uid()
  );

create policy topics_admin_update on topics
  for update using (is_admin());

-- ── notes ─────────────────────────────────────────────────────────────────

create policy notes_self_read on notes
  for select using (voter_id = auth.uid());

create policy notes_class_read on notes
  for select using (is_approved() and visibility = 'class');

create policy notes_self_write on notes
  for all using (voter_id = auth.uid())
  with check (voter_id = auth.uid());

-- ── ballots (secrecy boundary) ────────────────────────────────────────────

create policy ballots_self_read on ballots
  for select using (voter_id = auth.uid());

create policy ballots_self_write on ballots
  for all using (voter_id = auth.uid())
  with check (
    voter_id = auth.uid()
    and exists (select 1 from topics where presenter_voter_id = auth.uid())
  );

-- Admin view: restricted columns only (via the view in 0007)
create policy ballots_admin_view_read on ballots
  for select using (is_admin());

-- ── rankings (secrecy boundary, continued) ────────────────────────────────
-- NO admin SELECT policy. Admins cannot read rankings.
-- Tally uses service_role (bypasses RLS).

create policy rankings_self_read on rankings
  for select using (
    ballot_id in (select id from ballots where voter_id = auth.uid())
  );

create policy rankings_self_write on rankings
  for all using (
    ballot_id in (
      select id from ballots
      where voter_id = auth.uid()
        and submitted_at is null
        and locked_at is null
    )
  ) with check (
    ballot_id in (
      select id from ballots
      where voter_id = auth.uid()
        and submitted_at is null
        and locked_at is null
    )
  );

-- ── voting_state ──────────────────────────────────────────────────────────

create policy voting_state_approved_read on voting_state
  for select using (is_approved());

create policy voting_state_admin_write on voting_state
  for update using (is_admin());

-- ── tally_results ─────────────────────────────────────────────────────────

create policy tally_results_approved_read on tally_results
  for select using (is_approved());

-- writes only via service_role

-- ── audit_log ─────────────────────────────────────────────────────────────

create policy audit_log_admin_read on audit_log
  for select using (is_admin());

-- writes only via service_role
