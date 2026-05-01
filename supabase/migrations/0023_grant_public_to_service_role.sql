-- 0023_grant_public_to_service_role.sql
-- Explicit table/sequence/function grants for the service_role Postgres role.
--
-- Supabase's new (non-JWT) API key system stopped auto-granting
-- service_role access to public.* on project bootstrap. The old JWT-based
-- service_role key got these grants for free; the new secret key (formerly
-- service_role key) hits "permission denied" without explicit grants.
--
-- service_role still has BYPASSRLS, so RLS policies remain authoritative
-- for the anon/authenticated paths. This migration just restores the
-- table-level access the platform used to set up implicitly.
--
-- Idempotent — re-running re-issues no-op grants.

grant all on all tables    in schema public to service_role;
grant all on all sequences in schema public to service_role;
grant all on all functions in schema public to service_role;

-- Future objects in `public` should also be granted automatically. The
-- service_role assumption above only covers existing objects; without
-- default privileges, any table/sequence/function added in a later
-- migration would need its own grant. Set defaults for the postgres
-- owner role so subsequent migrations don't have to repeat themselves.
alter default privileges in schema public
  grant all on tables    to service_role;
alter default privileges in schema public
  grant all on sequences to service_role;
alter default privileges in schema public
  grant all on functions to service_role;
