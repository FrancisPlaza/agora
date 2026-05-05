-- 0027_show_art_to_all_approved.sql
-- The class decided to share artwork with the gallery as soon as it's
-- uploaded, regardless of whether the presenter has done their oral
-- presentation. The post-Phase-7.6 behaviour (per migration 0017)
-- gated the storage SELECT on `topics.presented_at IS NOT NULL` for
-- non-presenters. This migration relaxes that gate to "any approved
-- voter can read", restoring the simpler shape from migration 0005.
--
-- Application-layer maskArtForViewer in lib/data/topics.ts and
-- lib/data/results.ts is removed in the matching commit; the storage
-- policy here is the authoritative gate on who can read the bytes.

drop policy presentations_read on storage.objects;
create policy presentations_read on storage.objects
  for select using (
    bucket_id = 'presentations'
    and public.is_approved()
  );
