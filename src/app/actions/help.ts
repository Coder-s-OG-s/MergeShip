'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';
import { ok, err, type Result } from '@/lib/result';
import { rateLimit } from '@/lib/rate-limit';

const PR_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

type HelpInput = {
  recId: number;
  // Can be a full GitHub PR URL or a plain-text message describing the issue.
  prUrl: string;
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

  const trimmed = input.prUrl.trim();
  const isGitHubUrl = PR_URL_RE.test(trimmed);

  // Use a stable key for cooldown: real PR URL if available, otherwise rec-scoped placeholder.
  const cooldownKey = isGitHubUrl ? trimmed : `rec:${input.recId}`;
  const reason = isGitHubUrl ? null : trimmed;

  const cutoff = new Date(Date.now() - COOLDOWN_HOURS * 3600 * 1000).toISOString();
  const { data: recent } = await service
    .from('help_requests')
    .select('id')
    .eq('pr_url', cooldownKey)
    .eq('user_id', user.id)
    .gte('created_at', cutoff)
    .limit(1);

  if (recent && recent.length > 0) {
    return err('cooldown', `wait ${COOLDOWN_HOURS}h before sending another help request`);
  }

  const { data: row, error: insertErr } = await service
    .from('help_requests')
    .insert({
      user_id: user.id,
      pr_url: cooldownKey,
      reason,
    })
    .select('id')
    .single();

  if (insertErr || !row) return err('persist_failed', insertErr?.message ?? 'insert failed');

  await inngest.send({
    name: 'help/dispatch',
    data: {
      helpRequestId: row.id,
      userId: user.id,
      prUrl: isGitHubUrl ? trimmed : null,
    },
  });

  return ok({ helpRequestId: row.id });
}
