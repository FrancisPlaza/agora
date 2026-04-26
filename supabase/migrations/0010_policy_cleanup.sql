-- 0010_policy_cleanup.sql
-- Rename the misleadingly-named ballots_admin_view_read policy (it's a
-- SELECT policy on the ballots table itself, not on a view) and drop the
-- ballots_admin_view view, which is unused by application code.

alter policy ballots_admin_view_read on ballots rename to ballots_admin_read;

drop view if exists ballots_admin_view;
