import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { sendWeeklyDigestEmail } from '@/lib/email';
import { xpToNextLevel } from '@/lib/xp/curve';

const BATCH_SIZE = 50;

type UserDigest = {
  id: string;
  githubHandle: string;
  email: string;
};

type UserXpSnapshot = {
  id: string;
  xp: number;
  level: number;
};

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
    const {
      users: eligibleUsers,
      xpSnapshots,
      skippedPreFilter,
    } = await step.run('fetch-eligible-users', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const { data: profiles, error } = await sb
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

      if (!profiles || profiles.length === 0) {
        return { users: [], xpSnapshots: [], skippedPreFilter: 0 };
      }

      const users: UserDigest[] = [];
      const xpMap: UserXpSnapshot[] = [];
      let noEmail = 0;

      for (const p of profiles) {
        const email = Array.isArray(p.profile_emails)
          ? (p.profile_emails as any)[0]?.email
          : (p.profile_emails as any)?.email;

        if (email) {
          users.push({ id: p.id, githubHandle: p.github_handle, email });
          xpMap.push({ id: p.id, xp: p.xp, level: p.level });
        } else {
          noEmail++;
        }
      }

      return { users, xpSnapshots: xpMap, skippedPreFilter: noEmail };
    });

    if (eligibleUsers.length === 0) {
      return { processed: 0, skipped: skippedPreFilter };
    }

    let processed = 0;
    let skipped = 0;

    for (let i = 0; i < eligibleUsers.length; i += BATCH_SIZE) {
      const batch = eligibleUsers.slice(i, i + BATCH_SIZE);
      const batchSnapshots = xpSnapshots.filter((s: UserXpSnapshot) =>
        batch.some((u: UserDigest) => u.id === s.id),
      );

      const result = await step.run(
        `send-digest-batch-${i}`,
        async (): Promise<{ batchProcessed: number; batchSkipped: number }> => {
          const sb = getServiceSupabase();
          if (!sb) throw new Error('service role missing');

          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          const isoSevenDaysAgo = sevenDaysAgo.toISOString();

          let batchProcessed = 0;
          let batchSkipped = 0;

          for (const user of batch) {
            try {
              const snapshot = batchSnapshots.find((s: UserXpSnapshot) => s.id === user.id);

              const { data: recentEvents, error: eventsErr } = await sb
                .from('xp_events')
                .select('xp_delta, source')
                .eq('user_id', user.id)
                .gte('created_at', isoSevenDaysAgo);

              if (eventsErr) {
                batchSkipped++;
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

              const { needed } = xpToNextLevel(snapshot?.xp ?? 0);

              await sendWeeklyDigestEmail({
                to: user.email,
                githubHandle: user.githubHandle,
                xpGained,
                currentLevel: snapshot?.level ?? 0,
                xpToNextLevel: needed,
                issuesCompleted,
                prsMerged,
                reviewsPerformed,
                recommendations: formattedRecs,
              });

              batchProcessed++;
            } catch {
              batchSkipped++;
            }
          }

          return { batchProcessed, batchSkipped };
        },
      );

      processed += result.batchProcessed;
      skipped += result.batchSkipped;
    }

    return { processed, skipped: skipped + skippedPreFilter };
  },
);
