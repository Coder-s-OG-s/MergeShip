'use server';

import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { listMaintainerInstalls, listMaintainerRepos } from '@/lib/maintainer/detect';
import { type FlaggedAccountRow } from './types';
import { logMaintainerAction } from './audit';
import { revalidatePath } from 'next/cache';

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

  // Step 1: Resolve user_ids that have activity in the maintainer's repos.
  // We do this BEFORE touching `flagged_accounts` so that the flagged-accounts
  // query can be scoped at the database level to those user_ids, eliminating
  // the prior data-leak path where the global table was loaded unscoped and
  // then filtered in JavaScript (see issue #755).
  const [prUsersRes, recUsersRes] = await Promise.all([
    service.from('pull_requests').select('author_user_id').in('repo_full_name', repos),
    service
      .from('recommendations')
      .select('user_id, issues!inner(repo_full_name)')
      .in('issues.repo_full_name', repos),
  ]);

  if (prUsersRes.error) {
    return err('query_failed', prUsersRes.error.message);
  }
  if (recUsersRes.error) {
    return err('query_failed', recUsersRes.error.message);
  }

  const activeUserIds = new Set<string>();
  for (const pr of prUsersRes.data ?? []) {
    if (pr.author_user_id) {
      activeUserIds.add(pr.author_user_id);
    }
  }
  for (const rec of recUsersRes.data ?? []) {
    if (rec.user_id) {
      activeUserIds.add(rec.user_id);
    }
  }

  if (activeUserIds.size === 0) {
    return ok([]);
  }

  const userIdsFilter = Array.from(activeUserIds);

  // Step 2: Query `flagged_accounts` scoped to users with activity in the
  // maintainer's repos. This is the query-level scoping the issue asked for.
  // We still post-filter by `evidence.items[].repo` because the JSONB
  // containment check is not portable across Supabase client versions, but
  // the unbounded global load is gone — the query can now return at most
  // flags for users the maintainer is already authorised to see.
  const { data: flags, error } = await service
    .from('flagged_accounts')
    .select('id, user_id, installation_id, reason, severity, evidence, detected_at')
    .eq('status', 'open')
    .or(`installation_id.is.null,installation_id.eq.${installationId}`)
    .in('user_id', userIdsFilter)
    .order('detected_at', { ascending: false })
    .limit(100);

  if (error) {
    return err('query_failed', error.message);
  }

  if (!flags || flags.length === 0) {
    return ok([]);
  }

  const allowedFlags = flags.filter((flag) => {
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
    .select('id, evidence, user_id, installation_id')
    .eq('id', flagId)
    .single();

  if (findError || !flag) {
    return err('not_found', 'Flag not found');
  }

  if (flag.installation_id != null && flag.installation_id !== installationId) {
    return err('not_authorised', 'flag belongs to a different installation');
  }

  const repos = await listMaintainerRepos(user.id, installationId);
  const evidence = flag.evidence as any;
  const items = Array.isArray(evidence?.items) ? evidence.items : [];

  if (items.length === 0) {
    return err('not_authorised', 'Flag has no evidence items');
  }

  const isAuthorized = items.every((item: any) => {
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

  revalidatePath('/maintainer');

  return ok({ ok: true });
}
