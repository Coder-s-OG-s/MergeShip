'use server';

import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerInstalls, listMaintainerRepos } from '@/lib/maintainer/detect';
import { type FlaggedAccountRow } from './types';
import { logMaintainerAction } from './audit';

export async function getFlaggedAccounts(args?: {
  installationId?: number;
}): Promise<Result<FlaggedAccountRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  let installationId = args?.installationId;

  if (!installationId) {
    const installs = await listMaintainerInstalls(user.id);
    const installationIds = installs.map((i) => i.installationId);
    if (installationIds.length === 0) {
      return ok([]);
    }
    installationId = installationIds[0];
  }

  if (!installationId) {
    return ok([]);
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  if (repos.length === 0) {
    return ok([]);
  }

  const { data: flags, error } = await service
    .from('flagged_accounts')
    .select('id, user_id, reason, severity, evidence, detected_at')
    .eq('status', 'open')
    .order('detected_at', { ascending: false });

  if (error) {
    return err('query_failed', error.message);
  }

  if (!flags || flags.length === 0) {
    return ok([]);
  }

  const userIds = Array.from(new Set(flags.map((flag) => flag.user_id).filter(Boolean)));
  if (userIds.length === 0) {
    return ok([]);
  }

  const { data: prUsers, error: prError } = await service
    .from('pull_requests')
    .select('author_user_id')
    .in('author_user_id', userIds)
    .in('repo_full_name', repos);

  if (prError) {
    return err('query_failed', prError.message);
  }

  const { data: recUsers, error: recError } = await service
    .from('recommendations')
    .select('user_id, issues!inner(repo_full_name)')
    .in('user_id', userIds)
    .in('issues.repo_full_name', repos);

  if (recError) {
    return err('query_failed', recError.message);
  }

  const activeUserIds = new Set<string>();
  for (const pr of prUsers ?? []) {
    if (pr.author_user_id) {
      activeUserIds.add(pr.author_user_id);
    }
  }
  for (const rec of recUsers ?? []) {
    if (rec.user_id) {
      activeUserIds.add(rec.user_id);
    }
  }

  const allowedFlags = flags.filter((flag) => {
    if (!flag.user_id || !activeUserIds.has(flag.user_id)) {
      return false;
    }
    const evidence = flag.evidence as any;
    const items = Array.isArray(evidence?.items) ? evidence.items : [];
    return items.some((item: any) => {
      const r = item.repo || item.repoFullName;
      return typeof r === 'string' && repos.includes(r);
    });
  });

  const limitedFlags = allowedFlags.slice(0, 10);

  const allowedUserIds = Array.from(
    new Set(limitedFlags.map((flag) => flag.user_id).filter(Boolean)),
  );
  const { data: profiles, error: profilesError } =
    allowedUserIds.length > 0
      ? await service
          .from('profiles')
          .select('id, github_handle, xp, level')
          .in('id', allowedUserIds)
      : { data: [], error: null };

  if (profilesError) {
    return err('query_failed', profilesError.message);
  }

  const profilesById = new Map(
    (profiles ?? []).map((profile) => [
      profile.id,
      {
        githubHandle: profile.github_handle ?? 'unknown',
        xp: profile.xp ?? 0,
        level: profile.level ?? 0,
      },
    ]),
  );

  return ok(
    limitedFlags.map((flag) => {
      const profile = profilesById.get(flag.user_id ?? '');

      const evidence = flag.evidence as any;
      const items = Array.isArray(evidence?.items) ? evidence.items : [];
      const filteredItems = items.filter((item: any) => {
        const r = item.repo || item.repoFullName;
        return typeof r === 'string' && repos.includes(r);
      });
      const count = filteredItems.length;
      let summary = 'Suspicious activity pattern detected.';
      if (flag.reason === 'daily_xp_event_spike') {
        const totalXp = filteredItems.reduce(
          (sum: number, item: any) => sum + (item.xpDelta ?? 0),
          0,
        );
        summary = `${count} XP event${count === 1 ? '' : 's'} in one UTC day (${totalXp} XP total).`;
      } else if (flag.reason === 'rapid_merge_spike') {
        summary = `${count} merged PR${count === 1 ? '' : 's'} landed inside one hour.`;
      } else if (flag.reason === 'reviewer_approval_concentration') {
        summary = `${count} approval${count === 1 ? '' : 's'} from the same reviewer in one week.`;
      }

      return {
        id: flag.id,
        githubHandle: profile?.githubHandle ?? 'unknown',
        xp: profile?.xp ?? 0,
        level: profile?.level ?? 0,
        reason: flag.reason,
        severity: flag.severity === 'high' ? 'high' : 'medium',
        detectedAt: flag.detected_at,
        summary: summary,
        count: count,
      };
    }),
  );
}

export async function resolveFlaggedAccount(
  flagId: number,
  status: 'reviewed' | 'dismissed',
  installationId: number,
): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', limit: 30, windowSec: 60 },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: flag, error: findError } = await service
    .from('flagged_accounts')
    .select('id, evidence, user_id')
    .eq('id', flagId)
    .single();

  if (findError || !flag) {
    return err('not_found', 'Flag not found');
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  const evidence = flag.evidence as any;
  const items = Array.isArray(evidence?.items) ? evidence.items : [];
  const isAuthorized = items.some((item: any) => {
    const r = item.repo || item.repoFullName;
    return typeof r === 'string' && repos.includes(r);
  });

  if (!isAuthorized) {
    return err('not_authorised', 'not authorized to resolve this flag');
  }

  const { error: updateError } = await service
    .from('flagged_accounts')
    .update({
      status,
      resolved_at: new Date().toISOString(),
    })
    .eq('id', flagId);

  if (updateError) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId,
      action: 'resolve_flagged_account',
      targetType: 'flagged_account',
      targetId: flagId.toString(),
      status: 'failed',
      errorMessage: updateError.message,
      newValues: { status },
    });
    return err('persist_failed', updateError.message);
  }

  await logMaintainerAction({
    actorUserId: user.id,
    installationId,
    action: 'resolve_flagged_account',
    targetType: 'flagged_account',
    targetId: flagId.toString(),
    status: 'success',
    newValues: { status },
  });

  return ok({ ok: true });
}
