'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { computeCurrentStreak } from '@/lib/xp/streak';

/**
 * Returns the signed-in user's current activity streak in days.
 * Reads the last 60 days of xp_events and walks them client-side via
 * computeCurrentStreak. Cheap query, runs on every dashboard render.
 */
export async function getCurrentStreak(): Promise<{ days: number }> {
  const sb = getServerSupabase();
  if (!sb) return { days: 0 };
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return { days: 0 };

  const service = getServiceSupabase();
  if (!service) return { days: 0 };

  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data: events } = await service
    .from('xp_events')
    .select('created_at')
    .eq('user_id', user.id)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  const todayYmd = new Date().toISOString().slice(0, 10);
  return { days: computeCurrentStreak(events ?? [], todayYmd) };
}

/**
 * Public variant: returns the streak for any user_id without requiring
 * the caller to be that user. Used by the public profile page.
 */
export async function getPublicStreak(userId: string): Promise<{ days: number }> {
  const service = getServiceSupabase();
  if (!service) return { days: 0 };

  const cutoff = new Date(Date.now() - 60 * 24 * 3600 * 1000).toISOString();
  const { data: events } = await service
    .from('xp_events')
    .select('created_at')
    .eq('user_id', userId)
    .gte('created_at', cutoff)
    .order('created_at', { ascending: false });

  const todayYmd = new Date().toISOString().slice(0, 10);
  return { days: computeCurrentStreak(events ?? [], todayYmd) };
}
