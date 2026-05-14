import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import {
  decideOrgGrant,
  decideRepoGrant,
  reconcileGrants,
  type ProposedGrant,
} from '@/lib/maintainer/discover';
import { cacheGet, cacheSet } from '@/lib/cache';

/**
 * Discovers every install + repo the user has admin/maintain access to and
 * reconciles the github_installation_users + installation_user_repos tables.
 *
 * Triggered from:
 *   - bootstrapProfile (sign-in) — fire-and-forget
 *   - installation.created — for the install creator
 *   - membership.added / member.added webhooks — for newly granted users
 *   - daily revalidation cron
 *
 * Idempotent. Dedup window via Redis (1h) to avoid spamming GitHub on
 * page reloads.
 */

type DiscoverEvent = {
  data: { userId: string; githubHandle: string; force?: boolean };
};

const DEDUP_TTL_S = 60 * 60; // 1h

export const maintainerDiscover = inngest.createFunction(
  { id: 'maintainer-discover', concurrency: { key: 'event.data.userId', limit: 1 } },
  [{ event: 'maintainer/discover' }, { cron: '0 2 * * *' }],
  async ({ event }) => {
    // Cron tick fires with empty event.data — run a sweep across all
    // recently-active users with a junction row. For point-in-time
    // triggers, event.data carries the specific user.
    if (!event.data || typeof event.data !== 'object') {
      return await sweep();
    }
    const e = event as DiscoverEvent;
    if (!e.data.userId) return await sweep();
    return await discoverForUser(e.data.userId, e.data.githubHandle, e.data.force === true);
  },
);

async function discoverForUser(
  userId: string,
  githubHandle: string,
  force: boolean,
): Promise<{ user: string; installs: number; toUpsert: number; toDelete: number }> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error('service role missing');

  if (!force) {
    const cached = await cacheGet<{ ranAt: number }>(`maint:discovered:${userId}`);
    if (cached) {
      return { user: userId, installs: 0, toUpsert: 0, toDelete: 0 };
    }
  }

  const { data: installs } = await sb
    .from('github_installations')
    .select('id, account_login, account_type')
    .is('uninstalled_at', null);
  const installRows = installs ?? [];

  const proposed: ProposedGrant[] = [];

  for (const install of installRows) {
    let octokit;
    try {
      octokit = await getInstallOctokit(install.id);
    } catch {
      continue;
    }

    // Path 1: org-admin via membership API. Only meaningful for org installs.
    if (install.account_type === 'Organization') {
      try {
        const res = await octokit.orgs.getMembershipForUser({
          org: install.account_login,
          username: githubHandle,
        });
        const grant = decideOrgGrant({
          role: res.data.role as 'admin' | 'member',
          state: res.data.state as 'active' | 'pending',
        });
        if (grant) {
          proposed.push({
            installationId: install.id,
            permissionLevel: grant,
            source: 'membership_check',
          });
          continue; // org_admin trumps any repo-level grant on the same install
        }
      } catch {
        // 404 = not a member; 403 = missing Members:Read perm; either way no grant
      }
    }

    // Path 2: User install matches the signed-in user's handle.
    if (
      install.account_type === 'User' &&
      install.account_login.toLowerCase() === githubHandle.toLowerCase()
    ) {
      proposed.push({
        installationId: install.id,
        permissionLevel: 'org_admin',
        source: 'install_creator',
      });
      continue;
    }

    // Path 3: per-repo permission across the install's repos.
    const { data: repos } = await sb
      .from('installation_repositories')
      .select('repo_full_name')
      .eq('installation_id', install.id);

    let highestRepoGrant: 'repo_admin' | 'repo_maintain' | null = null;
    const repoGrants: Array<{ repo: string; perm: 'admin' | 'maintain' }> = [];
    for (const r of repos ?? []) {
      const [owner, name] = r.repo_full_name.split('/');
      if (!owner || !name) continue;
      try {
        const perm = await octokit.repos.getCollaboratorPermissionLevel({
          owner,
          repo: name,
          username: githubHandle,
        });
        const grant = decideRepoGrant(perm.data.permission ?? 'none');
        if (grant) {
          if (grant === 'repo_admin') highestRepoGrant = 'repo_admin';
          else if (!highestRepoGrant) highestRepoGrant = 'repo_maintain';
          repoGrants.push({
            repo: r.repo_full_name,
            perm: grant === 'repo_admin' ? 'admin' : 'maintain',
          });
        }
      } catch {
        // Skip; repo may be archived / inaccessible
      }
    }

    if (highestRepoGrant && repoGrants.length > 0) {
      proposed.push({
        installationId: install.id,
        permissionLevel: highestRepoGrant,
        source: 'membership_check',
      });

      // Refresh installation_user_repos for this install/user.
      await sb
        .from('installation_user_repos')
        .delete()
        .eq('installation_id', install.id)
        .eq('user_id', userId);
      await sb.from('installation_user_repos').insert(
        repoGrants.map((g) => ({
          installation_id: install.id,
          user_id: userId,
          repo_full_name: g.repo,
          permission_level: g.perm,
        })),
      );
    }
  }

  // Reconcile junction.
  const { data: existing } = await sb
    .from('github_installation_users')
    .select('installation_id, permission_level')
    .eq('user_id', userId);
  const existingGrants = (existing ?? []).map((r) => ({
    installationId: r.installation_id as number,
    permissionLevel: r.permission_level as ProposedGrant['permissionLevel'],
  }));

  const { toUpsert, toDelete } = reconcileGrants(existingGrants, proposed);

  if (toUpsert.length > 0) {
    await sb.from('github_installation_users').upsert(
      toUpsert.map((g) => ({
        installation_id: g.installationId,
        user_id: userId,
        permission_level: g.permissionLevel,
        source: g.source,
        verified_at: new Date().toISOString(),
      })),
      { onConflict: 'installation_id,user_id' },
    );
  }
  if (toDelete.length > 0) {
    await sb
      .from('github_installation_users')
      .delete()
      .eq('user_id', userId)
      .in('installation_id', toDelete);
    // Also clear scope rows for dropped installs
    await sb
      .from('installation_user_repos')
      .delete()
      .eq('user_id', userId)
      .in('installation_id', toDelete);
  }

  await cacheSet(`maint:discovered:${userId}`, { ranAt: Date.now() }, DEDUP_TTL_S);
  // Bust the maintainer-status boolean cache so the nav link updates next page load.
  await cacheSet(`maint:status:${userId}`, false, 1);

  return {
    user: userId,
    installs: installRows.length,
    toUpsert: toUpsert.length,
    toDelete: toDelete.length,
  };
}

async function sweep(): Promise<{ swept: number }> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error('service role missing');

  // Pull every distinct user with at least one junction row. Throttle by
  // processing 100 max per cron tick to stay well under API quotas.
  const { data: rows } = await sb.from('github_installation_users').select('user_id').limit(500);
  const seen = new Set<string>();
  const userIds = (rows ?? [])
    .map((r) => r.user_id)
    .filter((id) => {
      if (seen.has(id)) return false;
      seen.add(id);
      return true;
    });

  let count = 0;
  for (const userId of userIds.slice(0, 100)) {
    const { data: profile } = await sb
      .from('profiles')
      .select('github_handle')
      .eq('id', userId)
      .maybeSingle();
    if (!profile?.github_handle) continue;
    await inngest.send({
      name: 'maintainer/discover',
      data: { userId, githubHandle: profile.github_handle, force: true },
    });
    count += 1;
  }
  return { swept: count };
}
