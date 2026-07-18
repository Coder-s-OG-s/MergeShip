import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

const BATCH_SIZE = 50;

export const recommendationsBuild = inngest.createFunction(
  { id: 'recommendations-build', concurrency: { limit: 1 } },
  [{ event: 'recommendations/build' }],
  async ({ step }) => {
    const sb = getServiceSupabase();
    if (!sb) throw new Error('service role missing');

    const users = await step.run('fetch-users', async () => {
      // Pull every user with an active install — these are the only users
      // who pass the gate and have a dashboard worth populating.
      const { data } = await sb
        .from('github_installations')
        .select('user_id')
        .is('uninstalled_at', null)
        .not('user_id', 'is', null);

      return (data ?? []).map((row) => row.user_id);
    });

    if (users.length === 0) {
      return { activeUsers: 0, batchesDispatched: 0 };
    }

    const batches = [];
    for (let i = 0; i < users.length; i += BATCH_SIZE) {
      batches.push(users.slice(i, i + BATCH_SIZE));
    }

    const events = batches.map((batch) => ({
      name: 'recommendations/build.worker',
      data: { userIds: batch },
    }));

    await step.sendEvent('dispatch-workers', events);

    return { activeUsers: users.length, batchesDispatched: batches.length };
  },
);
