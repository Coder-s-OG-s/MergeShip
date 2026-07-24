-- Notification center Phase 2: read/unread tracking for activity_log.
-- All existing writes to activity_log go through the service role (RLS
-- bypassed), so this column addition doesn't change write behavior. The
-- update policy below is defense-in-depth in case activity_log is ever
-- read/written via a user-scoped client instead of the service role.

alter table activity_log add column if not exists read_at timestamptz;

drop policy if exists activity_update_own on activity_log;
create policy activity_update_own on activity_log for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
