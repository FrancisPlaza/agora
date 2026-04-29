-- 0017_allow_pre_presented_upload.sql
-- Phase 7.6: Allow presenters to upload before the beadle marks them
-- presented. The art stays hidden from non-presenters via the storage
-- read policy until presented_at is set. Visibility on the topic row's
-- art fields is masked at the application layer (see lib/data/topics.ts
-- and lib/data/results.ts — maskArtForViewer).
--
-- The other two CHECK constraints on `topics` stay:
--   * presented_requires_presenter — a topic still needs a presenter
--     before it can be marked presented.
--   * published_requires_all_art — when art_uploaded_at is set, all
--     three art fields (title, explanation, image_path) must be set.
--
-- Storage policies. Two changes:
--   * presentations_presenter_write: drop the presented_at gate so the
--     assigned presenter can upload before the beadle marks them.
--   * presentations_read: only return rows where the topic is presented
--     OR the caller is the presenter themselves. Approved-only baseline
--     stays (the bucket isn't public).

alter table public.topics drop constraint published_requires_presented;

drop policy presentations_presenter_write on storage.objects;
create policy presentations_presenter_write on storage.objects
  for insert with check (
    bucket_id = 'presentations'
    and exists (
      select 1 from public.topics t
      where t.id = (split_part(name, '/', 1))::int
        and t.presenter_voter_id = auth.uid()
    )
  );

drop policy presentations_read on storage.objects;
create policy presentations_read on storage.objects
  for select using (
    bucket_id = 'presentations'
    and public.is_approved()
    and exists (
      select 1 from public.topics t
      where t.id = (split_part(name, '/', 1))::int
        and (t.presented_at is not null or t.presenter_voter_id = auth.uid())
    )
  );
