import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { rateLimit } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import type { User, SupabaseClient } from '@supabase/supabase-js';

export type ActionAuthOptions = {
  rateLimit?: {
    namespace: string;
    limit: number;
    windowSec: number;
  };
  rateLimitMessage?: string;
  requireService?: boolean;
};

export type ActionAuthSuccess<TRequireService extends boolean | undefined = undefined> = {
  user: User;
  sb: SupabaseClient;
  service: TRequireService extends true ? SupabaseClient : SupabaseClient | null;
};

export async function requireUser<T extends ActionAuthOptions>(
  opts?: T,
): Promise<Result<ActionAuthSuccess<T['requireService']>>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');

  let service: SupabaseClient | null = null;
  if (opts?.requireService) {
    service = getServiceSupabase();
    if (!service) return err('not_configured', 'service role missing');
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  if (opts?.rateLimit) {
    const limited = await rateLimit({
      namespace: opts.rateLimit.namespace,
      key: user.id,
      limit: opts.rateLimit.limit,
      windowSec: opts.rateLimit.windowSec,
    });
    if (!limited.ok) {
      return err('rate_limited', opts.rateLimitMessage ?? 'slow down', true, limited.resetAt);
    }
  }

  return ok({ user, sb, service } as ActionAuthSuccess<T['requireService']>);
}

export async function requireMaintainer<T extends ActionAuthOptions>(
  opts?: T,
): Promise<Result<ActionAuthSuccess<T['requireService']>>> {
  const userRes = await requireUser(opts);
  if (!userRes.ok) return userRes;

  if (!(await isUserMaintainer(userRes.data.user.id))) {
    return err('not_authorised', 'not a maintainer');
  }

  return userRes;
}

// Compatibility helper used by existing maintainer server actions.
export async function requireMaintainerAuth(): Promise<Result<ActionAuthSuccess>> {
  return requireMaintainer();
}
