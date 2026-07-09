'use server';

import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { requireUser, requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import {
  listMaintainerInstalls,
  listMaintainerRepos,
  type MaintainerInstall,
} from '@/lib/maintainer/detect';
import { type InstallationSettingsData, type RepoPickerRow } from './types';
import { MIN_CONTRIBUTOR_LEVELS } from './constants';
import { logMaintainerAction } from './audit';

async function assertMaintainerInstall(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  userId: string,
  installationId: number,
): Promise<boolean> {
  const { data: junction } = await service
    .from('github_installation_users')
    .select('permission_level')
    .eq('user_id', userId)
    .eq('installation_id', installationId)
    .maybeSingle();

  return (
    !!junction &&
    (junction.permission_level === 'org_admin' || junction.permission_level === 'repo_admin')
  );
}

async function readInstallationSettings(
  service: NonNullable<ReturnType<typeof getServiceSupabase>>,
  installationId: number,
): Promise<Omit<InstallationSettingsData, 'installationId'>> {
  const { data } = await service
    .from('installation_settings')
    .select('min_contributor_level, auto_assign_mentor_chain, ai_pr_detection')
    .eq('installation_id', installationId)
    .maybeSingle();

  const level = data?.min_contributor_level;
  return {
    minContributorLevel: MIN_CONTRIBUTOR_LEVELS.has(level) ? (level as 0 | 1 | 2 | 3) : 0,
    autoAssignMentorChain: data?.auto_assign_mentor_chain ?? false,
    aiPrDetection: data?.ai_pr_detection ?? false,
  };
}

export async function getMaintainerInstalls(): Promise<Result<MaintainerInstall[]>> {
  const authRes = await requireUser();
  if (!authRes.ok) return authRes;
  const { user } = authRes.data;

  const installs = await listMaintainerInstalls(user.id);
  return ok(installs);
}

export async function getInstallationSettings(
  installationId: number,
): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, installationId))) {
    return err('not_authorised', 'not your install');
  }

  const settings = await readInstallationSettings(service, installationId);
  return ok({
    installationId,
    ...settings,
  });
}

export async function setMinContributorLevel(opts: {
  installationId: number;
  minContributorLevel: number;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!MIN_CONTRIBUTOR_LEVELS.has(opts.minContributorLevel)) {
    return err('invalid_input', 'minimum contributor level must be L0, L1, L2, or L3');
  }

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const minContributorLevel = opts.minContributorLevel as 0 | 1 | 2 | 3;
  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: minContributorLevel,
      auto_assign_mentor_chain: current.autoAssignMentorChain,
      ai_pr_detection: current.aiPrDetection,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId: opts.installationId,
      action: 'set_min_contributor_level',
      targetType: 'installation_settings',
      targetId: opts.installationId.toString(),
      status: 'failed',
      errorMessage: error.message,
      oldValues: { minContributorLevel: current.minContributorLevel },
      newValues: { minContributorLevel },
    });
    return err('persist_failed', error.message);
  }

  await logMaintainerAction({
    actorUserId: user.id,
    installationId: opts.installationId,
    action: 'set_min_contributor_level',
    targetType: 'installation_settings',
    targetId: opts.installationId.toString(),
    status: 'success',
    oldValues: { minContributorLevel: current.minContributorLevel },
    newValues: { minContributorLevel },
  });

  return ok({
    installationId: opts.installationId,
    minContributorLevel,
    autoAssignMentorChain: current.autoAssignMentorChain,
    aiPrDetection: current.aiPrDetection,
  });
}

export async function setAutoAssignMentorChain(opts: {
  installationId: number;
  enabled: boolean;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: current.minContributorLevel,
      auto_assign_mentor_chain: opts.enabled,
      ai_pr_detection: current.aiPrDetection,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId: opts.installationId,
      action: 'set_auto_assign_mentor_chain',
      targetType: 'installation_settings',
      targetId: opts.installationId.toString(),
      status: 'failed',
      errorMessage: error.message,
      oldValues: { autoAssignMentorChain: current.autoAssignMentorChain },
      newValues: { autoAssignMentorChain: opts.enabled },
    });
    return err('persist_failed', error.message);
  }

  await logMaintainerAction({
    actorUserId: user.id,
    installationId: opts.installationId,
    action: 'set_auto_assign_mentor_chain',
    targetType: 'installation_settings',
    targetId: opts.installationId.toString(),
    status: 'success',
    oldValues: { autoAssignMentorChain: current.autoAssignMentorChain },
    newValues: { autoAssignMentorChain: opts.enabled },
  });

  return ok({
    installationId: opts.installationId,
    minContributorLevel: current.minContributorLevel,
    autoAssignMentorChain: opts.enabled,
    aiPrDetection: current.aiPrDetection,
  });
}

export async function setAiPrDetection(opts: {
  installationId: number;
  enabled: boolean;
}): Promise<Result<InstallationSettingsData>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:settings', limit: 30, windowSec: 60 },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  if (!(await assertMaintainerInstall(service, user.id, opts.installationId))) {
    return err('not_authorised', 'not your install');
  }

  const current = await readInstallationSettings(service, opts.installationId);
  const { error } = await service.from('installation_settings').upsert(
    {
      installation_id: opts.installationId,
      min_contributor_level: current.minContributorLevel,
      auto_assign_mentor_chain: current.autoAssignMentorChain,
      ai_pr_detection: opts.enabled,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'installation_id' },
  );
  if (error) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId: opts.installationId,
      action: 'set_ai_pr_detection',
      targetType: 'installation_settings',
      targetId: opts.installationId.toString(),
      status: 'failed',
      errorMessage: error.message,
      oldValues: { aiPrDetection: current.aiPrDetection },
      newValues: { aiPrDetection: opts.enabled },
    });
    return err('persist_failed', error.message);
  }

  await logMaintainerAction({
    actorUserId: user.id,
    installationId: opts.installationId,
    action: 'set_ai_pr_detection',
    targetType: 'installation_settings',
    targetId: opts.installationId.toString(),
    status: 'success',
    oldValues: { aiPrDetection: current.aiPrDetection },
    newValues: { aiPrDetection: opts.enabled },
  });

  return ok({
    installationId: opts.installationId,
    minContributorLevel: current.minContributorLevel,
    autoAssignMentorChain: current.autoAssignMentorChain,
    aiPrDetection: opts.enabled,
  });
}

export async function getRepoPicker(installationId: number): Promise<Result<RepoPickerRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:repo-picker', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Scope to repos the caller actually maintains for this install.
  const scoped = new Set(await listMaintainerRepos(user.id, installationId));
  if (scoped.size === 0) return ok([]);

  const { data: repoRows } = await service
    .from('installation_repositories')
    .select('repo_full_name, managed, added_at')
    .eq('installation_id', installationId);

  const repos = (repoRows ?? [])
    .map((r) => r as { repo_full_name: string; managed: boolean; added_at: string })
    .filter((r) => scoped.has(r.repo_full_name));
  if (repos.length === 0) return ok([]);

  const repoNames = repos.map((r) => r.repo_full_name);

  // Metadata, derived from tables we already keep. Both queries are scoped to
  // the picker's repo set, so they stay small.
  const openPrCount = new Map<string, number>();
  const lastUpdatedAt = new Map<string, string>();
  const { data: prs } = await service
    .from('pull_requests')
    .select('repo_full_name, state, github_updated_at')
    .in('repo_full_name', repoNames);
  for (const row of (prs ?? []) as {
    repo_full_name: string;
    state: string;
    github_updated_at: string;
  }[]) {
    if (row.state === 'open') {
      openPrCount.set(row.repo_full_name, (openPrCount.get(row.repo_full_name) ?? 0) + 1);
    }
    const prev = lastUpdatedAt.get(row.repo_full_name);
    // Compare as parsed instants — these timestamps may carry offsets, so a
    // lexicographic string compare isn't reliable.
    if (!prev || Date.parse(row.github_updated_at) > Date.parse(prev)) {
      lastUpdatedAt.set(row.repo_full_name, row.github_updated_at);
    }
  }

  const language = new Map<string, string>();
  const { data: issueRows } = await service
    .from('issues')
    .select('repo_full_name, repo_language')
    .in('repo_full_name', repoNames)
    .not('repo_language', 'is', null);
  for (const row of (issueRows ?? []) as { repo_full_name: string; repo_language: string }[]) {
    // repo_language is the repo's primary language — same across its issues, so
    // the first non-null wins.
    if (!language.has(row.repo_full_name)) {
      language.set(row.repo_full_name, row.repo_language);
    }
  }

  return ok(
    repos.map((r) => ({
      repoFullName: r.repo_full_name,
      managed: r.managed,
      language: language.get(r.repo_full_name) ?? null,
      openPrCount: openPrCount.get(r.repo_full_name) ?? 0,
      lastUpdatedAt: lastUpdatedAt.get(r.repo_full_name) ?? r.added_at,
    })),
  );
}

export async function setRepoManaged(input: {
  installationId: number;
  repoFullName: string;
  managed: boolean;
}): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:repo-managed', ...RATE_LIMIT_TIERS.GENEROUS },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const scoped = await listMaintainerRepos(user.id, input.installationId);
  if (!scoped.includes(input.repoFullName)) {
    return err('not_authorised', 'not your repo');
  }

  const { data, error } = await service
    .from('installation_repositories')
    .update({ managed: input.managed })
    .eq('installation_id', input.installationId)
    .eq('repo_full_name', input.repoFullName)
    .select('repo_full_name');
  if (error) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId: input.installationId,
      action: 'set_repo_managed',
      targetType: 'repository',
      targetId: input.repoFullName,
      status: 'failed',
      errorMessage: error.message,
      newValues: { managed: input.managed },
    });
    return err('persist_failed', error.message);
  }
  // Zero rows updated → the repo isn't installed under this install (e.g. stale
  // scope data). Surface it rather than reporting a phantom success.
  if (!data || data.length === 0) {
    await logMaintainerAction({
      actorUserId: user.id,
      installationId: input.installationId,
      action: 'set_repo_managed',
      targetType: 'repository',
      targetId: input.repoFullName,
      status: 'failed',
      errorMessage: 'repo not found for install',
      newValues: { managed: input.managed },
    });
    return err('not_found', 'repo not found for install');
  }

  await logMaintainerAction({
    actorUserId: user.id,
    installationId: input.installationId,
    action: 'set_repo_managed',
    targetType: 'repository',
    targetId: input.repoFullName,
    status: 'success',
    newValues: { managed: input.managed },
  });

  return ok({ ok: true });
}
