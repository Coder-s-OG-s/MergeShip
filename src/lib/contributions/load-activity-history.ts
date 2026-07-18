import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheGet } from '@/lib/cache';
import {
  bumpActivityDay,
  contributionCalendarToActivity,
  type ActivityDay,
} from '@/lib/contributions/activity-history';

const HEATMAP_XP_SOURCES = ['unrecommended_merge', 'help_review'] as const;

type CachedContributionCalendar = {
  days: { date: string; contributionCount: number }[];
};

export async function loadActivityHistory(userId: string): Promise<ActivityDay[]> {
  const cached = await cacheGet<CachedContributionCalendar>(`gh:contrib:${userId}`);
  if (cached?.days?.length) {
    return contributionCalendarToActivity(cached.days);
  }

  const service = getServiceSupabase();
  if (!service) return [];

  const countMap = new Map<string, number>();

  const [{ data: xpEvents }, { data: mergedPrs }] = await Promise.all([
    service
      .from('xp_events')
      .select('created_at')
      .eq('user_id', userId)
      .in('source', [...HEATMAP_XP_SOURCES]),
    service
      .from('pull_requests')
      .select('merged_at')
      .eq('author_user_id', userId)
      .eq('state', 'merged')
      .not('merged_at', 'is', null),
  ]);

  for (const event of xpEvents ?? []) {
    bumpActivityDay(countMap, event.created_at);
  }
  for (const pr of mergedPrs ?? []) {
    bumpActivityDay(countMap, pr.merged_at);
  }

  return Array.from(countMap.entries()).map(([date, count]) => ({ date, count }));
}
