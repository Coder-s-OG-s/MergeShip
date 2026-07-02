import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { xpToNextLevel } from '@/lib/xp/curve';

export const weeklyDigest = inngest.createFunction(
  {
    id: 'weekly-digest',
    name: 'Weekly Contributor Progress Digest',
    // Prevent multiple overlapping executions
    concurrency: {
      limit: 1,
    },
  },
  { cron: '0 12 * * 1' }, // Every Monday at 12:00 PM UTC
  async ({ step }) => {
    // 1. Fetch eligible users (batch size limit can be applied here)
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
      return { processed: 0, skipped: 0 };
    }

    let processedCount = 0;
    let skippedCount = 0;

    for (const user of usersToProcess) {
      const email = Array.isArray(user.profile_emails)
        ? (user.profile_emails as any)[0]?.email
        : (user.profile_emails as any)?.email;

      // Permanent skip: no email address on record — no point retrying.
      if (!email) {
        skippedCount++;
        continue;
      }

      const result = await step.run(`send-email-${user.id}`, async () => {
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
          .eq('user_id', user.id)
          .gte('created_at', isoSevenDaysAgo);

        if (eventsErr) {
          throw new Error(`Failed to fetch xp_events for ${user.id}: ${eventsErr.message}`);
        }

        let xpGained = 0;
        let issuesCompleted = 0;
        let prsMerged = 0;
        let reviewsPerformed = 0;

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
          .eq('user_id', user.id)
          .eq('status', 'open')
          .order('recommended_at', { ascending: false })
          .limit(3);

        const formattedRecs = (recs || []).map((r: any) => ({
          title: r.issues?.title || 'Unknown Issue',
          url: r.issues?.url || '#',
          xpReward: r.xp_reward,
        }));

        const { needed } = xpToNextLevel(user.xp);

        // Throw on email send failure so Inngest retries the step (transient failure).
        await sendWeeklyDigestEmail({
          to: email,
          githubHandle: user.github_handle,
          xpGained,
          currentLevel: user.level,
          xpToNextLevel: needed,
          issuesCompleted,
          prsMerged,
          reviewsPerformed,
          recommendations: formattedRecs,
        });

        return { sent: true };
      });

      if (result && result.sent) {
        processedCount++;
      } else {
        skippedCount++;
      }
    }

    return { processed: processedCount, skipped: skippedCount };
  },
);
