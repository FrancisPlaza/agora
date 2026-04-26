-- 0011_fix_trigger_search_path.sql
-- Fix latent bug in 0002 triggers surfaced when Phase 2 first exercised the
-- real magic-link signup flow. Both `handle_new_user` and
-- `handle_email_confirmed` are `security definer` functions but had no
-- `set search_path`, so under the auth role they couldn't resolve the
-- unqualified `profiles` table reference and the trigger raised
-- "relation profiles does not exist". Setting the search path explicitly
-- restores resolution; semantics are unchanged.

create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  insert into profiles (id, email, full_name, student_id, status)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', ''),
    coalesce(new.raw_user_meta_data->>'student_id', ''),
    'pending_email'
  );
  return new;
end $$;

create or replace function handle_email_confirmed()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles set status = 'pending_approval' where id = new.id;
  end if;
  return new;
end $$;
