-- 0003_helpers.sql
-- SQL helper functions for RLS policies.

create function is_approved() returns boolean language sql stable as $$
  select coalesce(
    (select status = 'approved' from profiles where id = auth.uid()),
    false
  );
$$;

create function is_admin() returns boolean language sql stable as $$
  select coalesce(
    (select is_admin and status = 'approved' from profiles where id = auth.uid()),
    false
  );
$$;
