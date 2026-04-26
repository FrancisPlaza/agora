-- 0007_views.sql
-- Admin view for ballots — restricted columns only.
-- Admins see ballot metadata but never individual rankings.

create view ballots_admin_view as
  select id, voter_id, submitted_at, locked_at, created_at, updated_at
  from ballots;

-- security_invoker ensures the view runs with the caller's RLS context,
-- so ballots_admin_view_read policy on ballots still applies.
alter view ballots_admin_view set (security_invoker = on);

grant select on ballots_admin_view to authenticated;
