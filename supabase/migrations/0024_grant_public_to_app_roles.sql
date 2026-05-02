-- 0024_grant_public_to_app_roles.sql
-- Explicit grants for `authenticated` and `anon` on the public schema.
--
-- Same Supabase platform regression as 0023: the new (non-JWT) API key
-- system stopped auto-granting DML privileges on bootstrap. Verified
-- empirically — `authenticated` and `anon` end up with only TRUNCATE /
-- REFERENCES / TRIGGER (the metadata-level privileges Postgres applies
-- by default) and no SELECT / INSERT / UPDATE / DELETE.
--
-- The visible symptom: the middleware and /auth/callback profile fetches
-- return null (silent permission denial), so every authenticated request
-- defaulted to status='pending_email' and redirected to /awaiting-email.
--
-- This migration restores the grants the platform used to set up
-- automatically. RLS still gates rows on top of the table-level grant.
-- Idempotent — re-running re-issues no-op grants.

grant usage on schema public to authenticated, anon;

grant select, insert, update, delete on all tables    in schema public to authenticated;
grant usage, select                  on all sequences in schema public to authenticated;
grant execute                        on all functions in schema public to authenticated;

grant select  on all tables    in schema public to anon;
grant select  on all sequences in schema public to anon;
grant execute on all functions in schema public to anon;

-- Default privileges for future migrations: any new table/sequence/function
-- gets the same grants automatically, no per-migration boilerplate.
alter default privileges in schema public
  grant select, insert, update, delete on tables    to authenticated;
alter default privileges in schema public
  grant usage, select                  on sequences to authenticated;
alter default privileges in schema public
  grant execute                        on functions to authenticated;

alter default privileges in schema public
  grant select  on tables    to anon;
alter default privileges in schema public
  grant select  on sequences to anon;
alter default privileges in schema public
  grant execute on functions to anon;
