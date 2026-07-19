'use server';

import { and, ilike, desc, inArray } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { issues, profiles } from '@/lib/db/schema';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';

export type SearchResult = {
  issues: {
    id: number;
    title: string;
    repoFullName: string;
    url: string;
  }[];
  profiles: {
    githubHandle: string;
    displayName: string | null;
    avatarUrl: string | null;
    level: number;
  }[];
};

/**
 * Escape ILIKE wildcard characters so user input is treated literally.
 * Escapes \, %, and _ before wrapping with %.
 */
function escapeIlike(input: string): string {
  return input.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export async function searchGlobal(query: string): Promise<Result<SearchResult>> {
  const sb = await getServerSupabase();
  if (!sb) return err('no_supabase', 'Database connection not available');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('unauthorized', 'Must be logged in to search');

  const limited = await rateLimit({
    namespace: 'search',
    key: user.id,
    ...RATE_LIMIT_TIERS.STANDARD,
  });
  if (!limited.ok) return err('rate_limited', 'slow down', true);

  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return ok({ issues: [], profiles: [] });
  }

  const searchPattern = `%${escapeIlike(cleanQuery)}%`;

  try {
    const service = getServiceSupabase();
    let allowedRepos: string[] = [];

    if (service) {
      const { data: installations } = await service
        .from('github_installation_users')
        .select('installation_id')
        .eq('user_id', user.id);

      if (installations && installations.length > 0) {
        const installIds = installations.map((i) => i.installation_id);
        const { data: repos } = await service
          .from('installation_repositories')
          .select('repo_full_name')
          .in('installation_id', installIds);

        allowedRepos = (repos ?? []).map((r) => r.repo_full_name);
      }
    }

    const db = getDb();
    const [matchedIssues, matchedProfiles] = await Promise.all([
      allowedRepos.length > 0
        ? db
            .select({
              id: issues.id,
              title: issues.title,
              repoFullName: issues.repoFullName,
              url: issues.url,
            })
            .from(issues)
            .where(
              and(ilike(issues.title, searchPattern), inArray(issues.repoFullName, allowedRepos)),
            )
            .orderBy(desc(issues.id))
            .limit(5)
        : Promise.resolve([]),

      db
        .select({
          githubHandle: profiles.githubHandle,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          level: profiles.level,
        })
        .from(profiles)
        .where(ilike(profiles.githubHandle, searchPattern))
        .orderBy(desc(profiles.level))
        .limit(5),
    ]);

    return ok({
      issues: matchedIssues,
      profiles: matchedProfiles,
    });
  } catch (error) {
    return err('search_failed', 'Failed to perform search');
  }
}
