'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';

/**
 * Notification center Phase 2 actions -- read/unread tracking on top of
 * activity_log.read_at (see supabase/migrations/0043_activity_log_read_at.sql).
 * Both actions use the service role, matching how activity_log is written
 * everywhere else (Inngest functions bypass RLS via the service role too).
 */

export async function getUnreadNotificationCount(): Promise<Result<number>> {
  const sb = await getServerSupabase();
  if (!sb) return err('no_supabase', 'Database connection not available');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('unauthorized', 'Must be logged in');

  const service = getServiceSupabase();
  if (!service) return err('no_supabase', 'Service role not configured');

  const { count, error } = await service
    .from('activity_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return err('db_error', error.message);
  return ok(count ?? 0);
}

/**
 * Marks every currently-unread notification for the signed-in user as read.
 * Called when the /notifications page is visited -- matches the "viewing
 * the list marks it read" pattern used by GitHub/Twitter notification
 * centers, so there's no separate per-item read/unread UI to build.
 */
export async function markAllNotificationsRead(): Promise<Result<void>> {
  const sb = await getServerSupabase();
  if (!sb) return err('no_supabase', 'Database connection not available');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('unauthorized', 'Must be logged in');

  const service = getServiceSupabase();
  if (!service) return err('no_supabase', 'Service role not configured');

  const { error } = await service
    .from('activity_log')
    .update({ read_at: new Date().toISOString() })
    .eq('user_id', user.id)
    .is('read_at', null);

  if (error) return err('db_error', error.message);
  return ok(undefined);
}
