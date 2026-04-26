-- 0005_storage.sql
-- Presentations bucket and storage policies.

insert into storage.buckets (id, name, public)
values ('presentations', 'presentations', false);

-- Approved voters can read all presentation files
create policy presentations_read on storage.objects
  for select using (bucket_id = 'presentations' and is_approved());

-- Only the assigned presenter can upload, when topic is in 'presented' state
create policy presentations_presenter_write on storage.objects
  for insert with check (
    bucket_id = 'presentations'
    and exists (
      select 1 from topics t
      where t.id = (split_part(name, '/', 1))::int
        and t.presenter_voter_id = auth.uid()
        and t.presented_at is not null
    )
  );

-- Presenter can delete their own file (to replace)
create policy presentations_presenter_delete on storage.objects
  for delete using (
    bucket_id = 'presentations'
    and exists (
      select 1 from topics t
      where t.id = (split_part(name, '/', 1))::int
        and t.presenter_voter_id = auth.uid()
    )
  );

-- Admins can delete (cleanup / abuse handling)
create policy presentations_admin_delete on storage.objects
  for delete using (bucket_id = 'presentations' and is_admin());
