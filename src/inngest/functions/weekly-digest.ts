import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { xpToNextLevel } from '@/lib/xp/curve';

/**
 * Returns the ISO date string (YYYY-MM-DD) of the Monday of the current week.
 * Used to produce stable, dedup-safe event IDs across retries of the same run.
 */
export function getWeekKey(now: Date = new Date()): string {
  const d = new Date(now);
  const day = d.getUTCDay(); // 0 = Sun, 1 = Mon, ...
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1); // adjust to Monday
  d.setUTCDate(diff);
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Dispatcher cron – runs every Monday at 12:00 UTC.
 * Fetches all users who opted-in to `weekly_digest`, builds one
 * `weekly-digest/send-to-user` event per eligible user (with a
 * stable `id` for Inngest dedup), and dispatches them in a single
 * `inngest.send()` call.
 */
export const weeklyDigest = inngest.createFunction(
  {
    id: 'weekly-digest',
    name: 'Weekly Contributor Progress Digest',
    concurrency: {
      limit: 1,
    },
  },
  { cron: '0 12 * * 1' },
  async ({ step }) => {
    const usersToProcess = await step.run('fetch-eligible-users', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const { data, error } = await sb
        .from('profiles')
        .select(
          `
          id,
          github_handle,
          xp,
          level,
          profile_emails!inner(email)
        `,
        )
        .eq('weekly_digest', true);

      if (error) throw new Error(`Failed to fetch profiles: ${error.message}`);
      return data;
    });

    if (!usersToProcess || usersToProcess.length === 0) {
      return { dispatched: 0 };
    }

    const weekKey = getWeekKey();

    const events = usersToProcess
      .map((user) => {
        const email = Array.isArray(user.profile_emails)
          ? (user.profile_emails as any)[0]?.email
          : (user.profile_emails as any)?.email;

        if (!email) return null;

        return {
          id: `weekly-digest-${user.id}-${weekKey}`,
          name: 'weekly-digest/send-to-user' as const,
          data: {
            userId: user.id,
            email,
            githubHandle: user.github_handle,
            xp: user.xp,
            level: user.level,
          },
        };
      })
      .filter((ev): ev is NonNullable<typeof ev> => ev !== null);

    if (events.length > 0) {
      await step.run('dispatch-user-digests', async () => {
        await inngest.send(events);
      });
    }

    return { dispatched: events.length };
  },
);

/**
 * Child function – processes a single user's weekly digest email.
 * Concurrency is capped at 5 to avoid spiking Resend/SMTP rate limits.
 */
export const sendUserDigest = inngest.createFunction(
  {
    id: 'send-user-digest',
    name: 'Send User Weekly Progress Digest',
    concurrency: {
      limit: 5,
    },
  },
  { event: 'weekly-digest/send-to-user' },
  async ({ event, step }) => {
    const { userId, email, githubHandle, xp, level } = event.data;

    await step.run('send-email', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      const isoSevenDaysAgo = sevenDaysAgo.toISOString();

      // Fetch XP events for the last 7 days.
      // Throw on DB error so Inngest retries the step (transient failure).
      const { data: recentEvents, error: eventsErr } = await sb
        .from('xp_events')
        .select('xp_delta, source')
        .eq('user_id', userId)
        .gte('created_at', isoSevenDaysAgo);

      if (eventsErr) {
        throw new Error(`Failed to fetch xp_events for ${userId}: ${eventsErr.message}`);
      }

      let xpGained = 0;
      let prsMerged = 0;
      let reviewsPerformed = 0;
      let issuesCompleted = 0;

      for (const ev of recentEvents || []) {
        xpGained += ev.xp_delta;
        if (ev.source === 'recommended_merge' || ev.source === 'unrecommended_merge') {
          prsMerged++;
        } else if (ev.source === 'review' || ev.source === 'help_review') {
          reviewsPerformed++;
        } else if (ev.source === 'issue_authored_closed') {
          issuesCompleted++;
        }
      }

      // Get top 3 open recommendations
      const { data: recs } = await sb
        .from('recommendations')
        .select(
          `
          xp_reward,
          issues!inner(title, url)
        `,
        )
        .eq('user_id', userId)
        .eq('status', 'open')
        .order('recommended_at', { ascending: false })
        .limit(3);

      const formattedRecs = (recs || []).map((r: any) => ({
        title: r.issues?.title || 'Unknown Issue',
        url: r.issues?.url || '#',
        xpReward: r.xp_reward,
      }));

      const { needed } = xpToNextLevel(xp);

      // Throw on email send failure so Inngest retries the step (transient failure).
      await sendWeeklyDigestEmail({
        to: email,
        githubHandle,
        xpGained,
        currentLevel: level,
        xpToNextLevel: needed,
        issuesCompleted,
        prsMerged,
        reviewsPerformed,
        recommendations: formattedRecs,
      });
    });

    return { success: true };
  },
);
