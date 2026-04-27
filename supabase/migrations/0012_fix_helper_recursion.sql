-- 0012_fix_helper_recursion.sql
-- Fix latent bug in 0003 helpers surfaced when Phase 3 first joined topics
-- to profiles via FK embed. `is_approved()` and `is_admin()` both query
-- `profiles` to check the caller's status. When RLS is on, that query
-- itself triggers the same `profiles_approved_read_others` policy, which
-- calls `is_approved()` again, ... infinite recursion (Postgres errors
-- with SQLSTATE 54001, "stack depth limit exceeded").
--
-- Phase 2 dodged this because the only profile read was the caller's own
-- row via `profiles_self_read` (id = auth.uid()), which doesn't go through
-- the helpers. The FK embed in Phase 3's `topics → profiles` join hits
-- `profiles_approved_read_others`, triggering the recursion.
--
-- Fix: mark both helpers `security definer` so the inner SELECT bypasses
-- RLS. Set search_path explicitly per the same pattern used in 0011.
-- Semantics unchanged.

create or replace function is_approved()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select status = 'approved' from profiles where id = auth.uid()),
    false
  );
$$;

create or replace function is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, auth
as $$
  select coalesce(
    (select is_admin and status = 'approved' from profiles where id = auth.uid()),
    false
  );
$$;
