-- 0028_presentations_bucket_public.sql
-- Switch the `presentations` bucket from private to public so the
-- storage URLs are stable across requests. With private + signed URLs,
-- every page render generated a fresh JWT token in the URL, so the
-- browser cache key changed every visit and the same image bytes were
-- refetched on every dashboard / vote-view load.
--
-- A public bucket bypasses RLS for direct URL fetches: anyone with
-- the URL can read the file without auth. The dashboard page itself
-- still requires login, but the artwork URLs are unauth-accessible
-- if shared externally. Acceptable trade-off given the May 2026
-- visibility change (migration 0027) — artwork is already class-
-- visible the moment it's uploaded; this just removes the URL-
-- freshness friction on the browser cache.
--
-- The presentations_read RLS policy stays in place (defence-in-depth
-- for SDK-level reads), but in practice the frontend now uses
-- getPublicUrl, which constructs URLs without an API call.

update storage.buckets set public = true where id = 'presentations';
