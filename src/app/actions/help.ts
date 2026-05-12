'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';
import { ok, err, type Result } from '@/lib/result';
import { rateLimit } from '@/lib/rate-limit';

type HelpInput = {
  recId: number;
  prUrl: string;
  reason?: string;
};

type HelpOutput = {
  helpRequestId: number;
};

const COOLDOWN_HOURS = 4;

export async function sendHelpRequest(input: HelpInput): Promise<Result<HelpOutput>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const limited = await rateLimit({
    namespace: 'help:send',
    key: user.id,
    limit: 5,
    windowSec: 60 * 60,
  });
  if (!limited.ok) return err('rate_limited', 'too many help requests this hour', true);

  // Cooldown: no second Help on same PR within COOLDOWN_HOURS
  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();
  const { data: recent } = await service
    .from('help_requests')
    .select('id')
    .eq('pr_url', input.prUrl)
    .eq('user_id', user.id)
    .gte('created_at', cutoff)
    .limit(1);

  if (recent && recent.length > 0) {
    return err('cooldown', `wait ${COOLDOWN_HOURS}h before another help request on this PR`);
  }

  const { data: row, error: insertErr } = await service
    .from('help_requests')
    .insert({
      user_id: user.id,
      recommendation_id: input.recId,
      pr_url: input.prUrl,
      reason: input.reason ?? null,
    })
    .select('id')
    .single();

  if (insertErr || !row) return err('persist_failed', insertErr?.message ?? 'insert failed');

  await inngest.send({
    name: 'help/dispatch',
    data: { helpRequestId: row.id, userId: user.id, prUrl: input.prUrl },
  });

  return ok({ helpRequestId: row.id });
}
