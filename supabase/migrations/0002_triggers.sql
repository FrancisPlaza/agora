-- 0002_triggers.sql
-- Auto-create profiles, email confirmation handler, updated_at bumps.

-- ── Auto-create profile on auth.users insert ──────────────────────────────

create function handle_new_user() returns trigger language plpgsql security definer as $$
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

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_user();

-- ── Promote to pending_approval on email confirmation ─────────────────────

create function handle_email_confirmed() returns trigger language plpgsql security definer as $$
begin
  if new.email_confirmed_at is not null and old.email_confirmed_at is null then
    update profiles set status = 'pending_approval' where id = new.id;
  end if;
  return new;
end $$;

create trigger on_email_confirmed
  after update on auth.users
  for each row execute function handle_email_confirmed();

-- ── Generic updated_at trigger ────────────────────────────────────────────

create function set_updated_at() returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

create trigger topics_updated_at before update on topics
  for each row execute function set_updated_at();

create trigger notes_updated_at before update on notes
  for each row execute function set_updated_at();

create trigger ballots_updated_at before update on ballots
  for each row execute function set_updated_at();

create trigger voting_state_updated_at before update on voting_state
  for each row execute function set_updated_at();
