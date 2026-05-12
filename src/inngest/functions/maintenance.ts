import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_REWARDS, XP_SOURCE, refIds } from '@/lib/xp/sources';

/**
 * Daily streak detection — gives +10 XP/day to users who had any qualifying
 * activity yesterday, with a 10-day cap.
 */
export const streakDetect = inngest.createFunction(
  { id: 'streak-detect' },
  { cron: '5 0 * * *' }, // 00:05 UTC daily
  async ({ step }) => {
    const result = await step.run('detect-streaks', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const today = new Date().toISOString().slice(0, 10);
      const yesterday = new Date(Date.now() - 24 * 3600 * 1000).toISOString().slice(0, 10);

      // Pull anyone who logged an XP event yesterday.
      const { data: actives } = await sb
        .from('xp_events')
        .select('user_id')
        .gte('created_at', `${yesterday}T00:00:00Z`)
        .lt('created_at', `${today}T00:00:00Z`)
        .neq('source', XP_SOURCE.STREAK);

      const uniqueUsers = new Set((actives ?? []).map((r) => r.user_id));
      let awarded = 0;
      for (const userId of uniqueUsers) {
        const inserted = await insertXpEvent({
          userId,
          source: XP_SOURCE.STREAK,
          refType: 'streak',
          refId: refIds.streak(yesterday),
          xpDelta: XP_REWARDS.STREAK_PER_DAY,
        });
        if (inserted) awarded += 1;
      }
      return { awarded, scanned: uniqueUsers.size };
    });
    return result;
  },
);

/**
 * Expire stale recommendations.
 * recommendations.expires_at < now AND status='open' → 'expired'.
 */
export const recsExpire = inngest.createFunction(
  { id: 'recs-expire' },
  { cron: '0 * * * *' }, // hourly
  async ({ step }) => {
    return await step.run('expire-stale-recs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const now = new Date().toISOString();
      const { data } = await sb
        .from('recommendations')
        .update({ status: 'expired' })
        .lt('expires_at', now)
        .eq('status', 'open')
        .select('id');
      return { expired: data?.length ?? 0 };
    });
  },
);

/**
 * activity_log keeps 30 days of trail. Daily cleanup keeps it cheap.
 */
export const activityLogCleanup = inngest.createFunction(
  { id: 'activity-log-cleanup' },
  { cron: '15 0 * * *' }, // 00:15 UTC daily
  async ({ step }) => {
    return await step.run('cleanup', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const cutoff = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
      const { data } = await sb.from('activity_log').delete().lt('created_at', cutoff).select('id');
      return { deleted: data?.length ?? 0 };
    });
  },
);
