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

    // Process in smaller batches using Inngest steps
    // For simplicity, we loop through and yield state if needed, or just process them in a single step if there are not too many.
    // In a real huge production, we would use step.sendEvent to fan out, but batching in a loop with small yields is fine.
    const BATCH_SIZE = 50;
    for (let i = 0; i < usersToProcess.length; i += BATCH_SIZE) {
      const batch = usersToProcess.slice(i, i + BATCH_SIZE);

      await step.run(`process-batch-${i}`, async () => {
        const sb = getServiceSupabase();
        if (!sb) return;

        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
        const isoSevenDaysAgo = sevenDaysAgo.toISOString();

        for (const user of batch) {
          try {
            const email = Array.isArray(user.profile_emails)
              ? (user.profile_emails as any)[0]?.email
              : (user.profile_emails as any)?.email;

            if (!email) {
              skippedCount++;
              continue;
            }

            // Fetch XP events for the last 7 days
            const { data: recentEvents, error: eventsErr } = await sb
              .from('xp_events')
              .select('xp_delta, source')
              .eq('user_id', user.id)
              .gte('created_at', isoSevenDaysAgo);

            if (eventsErr) {
              console.error(`Failed to fetch events for ${user.id}:`, eventsErr);
              continue;
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

            // Skip if completely inactive? Let's still send it, maybe it motivates them.
            // Or maybe skip to save emails. We'll send it regardless to keep them engaged.

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

            processedCount++;
          } catch (e) {
            console.error(`Failed processing user ${user.id}`, e);
            skippedCount++;
          }
        }
      });
    }

    return { processed: processedCount, skipped: skippedCount };
  },
);
