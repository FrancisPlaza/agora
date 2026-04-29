-- 0018_topics_update_policy.sql
-- Phase 7.6 widened the pre-presented upload flow but missed this policy.
-- Storage RLS lets a presenter write to {topic_id}/* anytime after they're
-- assigned the topic, but the topic-row UPDATE policy still required
-- presented_at IS NOT NULL. The upload action's storage write succeeded;
-- the topic row update was silently denied (zero rows affected, no error
-- surfaced in the JS client). Net effect: orphan storage files, art
-- fields stayed null, dashboard banner kept saying "upload your art early".
--
-- Fix: drop the presented_at gate. The presenter owns the topic from
-- assignment onwards; data integrity for the published state is enforced
-- by the published_requires_all_art CHECK constraint, not by the policy.

drop policy topics_presenter_update_art on public.topics;

create policy topics_presenter_update_art on public.topics
  for update using (presenter_voter_id = auth.uid())
  with check (presenter_voter_id = auth.uid());
