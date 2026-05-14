import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/cache';

/**
 * "Is this user a maintainer?" — true if they have at least one active
 * junction row to a github_installations row that isn't uninstalled.
 *
 * Cached per user for 1h. Cache is busted by:
 *   - maintainer-discover function (after writing junction changes)
 *   - process-installation-event (on installation.deleted)
 */

const TTL_S = 60 * 60;

export async function isUserMaintainer(userId: string): Promise<boolean> {
  const cacheKey = `maint:status:${userId}`;
  const cached = await cacheGet<boolean>(cacheKey);
  if (cached !== null) return cached;

  const sb = getServiceSupabase();
  if (!sb) {
    await cacheSet(cacheKey, false, TTL_S);
    return false;
  }

  const { data } = await sb
    .from('github_installation_users')
    .select('installation_id, github_installations!inner(uninstalled_at)')
    .eq('user_id', userId)
    .limit(20);

  const has = (data ?? []).some((row) => {
    const i = (row as unknown as { github_installations: { uninstalled_at: string | null } | null })
      .github_installations;
    return i && i.uninstalled_at === null;
  });

  await cacheSet(cacheKey, has, TTL_S);
  return has;
}

/**
 * Return list of active installs this user maintains, used by the org
 * switcher on /maintainer.
 */
export type MaintainerInstall = {
  installationId: number;
  accountLogin: string;
  accountType: 'User' | 'Organization';
  permissionLevel: 'org_admin' | 'repo_admin' | 'repo_maintain';
};

export async function listMaintainerInstalls(userId: string): Promise<MaintainerInstall[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];

  const { data } = await sb
    .from('github_installation_users')
    .select(
      'installation_id, permission_level, github_installations!inner(account_login, account_type, uninstalled_at)',
    )
    .eq('user_id', userId);

  type Row = {
    installation_id: number;
    permission_level: MaintainerInstall['permissionLevel'];
    github_installations: {
      account_login: string;
      account_type: 'User' | 'Organization';
      uninstalled_at: string | null;
    } | null;
  };

  return (data ?? [])
    .map((row) => row as unknown as Row)
    .filter((r) => r.github_installations && r.github_installations.uninstalled_at === null)
    .map((r) => ({
      installationId: r.installation_id,
      accountLogin: r.github_installations!.account_login,
      accountType: r.github_installations!.account_type,
      permissionLevel: r.permission_level,
    }));
}

/**
 * Returns the set of repos the user can see on /maintainer for a given
 * install. org_admin sees everything in installation_repositories.
 * repo_admin / repo_maintain sees only their installation_user_repos rows.
 */
export async function listMaintainerRepos(
  userId: string,
  installationId: number,
): Promise<string[]> {
  const sb = getServiceSupabase();
  if (!sb) return [];

  const { data: junction } = await sb
    .from('github_installation_users')
    .select('permission_level')
    .eq('user_id', userId)
    .eq('installation_id', installationId)
    .maybeSingle();

  if (!junction) return [];

  if (junction.permission_level === 'org_admin') {
    const { data: repos } = await sb
      .from('installation_repositories')
      .select('repo_full_name')
      .eq('installation_id', installationId);
    return (repos ?? []).map((r) => r.repo_full_name);
  }

  const { data: scoped } = await sb
    .from('installation_user_repos')
    .select('repo_full_name')
    .eq('installation_id', installationId)
    .eq('user_id', userId);
  return (scoped ?? []).map((r) => r.repo_full_name);
}
