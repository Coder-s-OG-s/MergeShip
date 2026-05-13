-- Foundational course is deferred to v2. Drop the table and its policies.
-- xp_events rows from prior course completions are kept (idempotency keys
-- mean they won't be regenerated, and their xp_delta is already counted in
-- profiles.xp).

drop policy if exists course_read_own on course_progress;
drop table if exists course_progress;
