'use server';

import { ilike } from 'drizzle-orm';
import { getDb } from '@/lib/db/client';
import { issues, profiles } from '@/lib/db/schema';
import { getServerSupabase } from '@/lib/supabase/server';
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

export async function searchGlobal(query: string): Promise<Result<SearchResult>> {
  const sb = getServerSupabase();
  if (!sb) return err('no_supabase', 'Database connection not available');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('unauthorized', 'Must be logged in to search');

  const cleanQuery = query.trim();
  if (cleanQuery.length < 2) {
    return ok({ issues: [], profiles: [] });
  }

  const searchPattern = `%${cleanQuery}%`;

  try {
    const db = getDb();
    const [matchedIssues, matchedProfiles] = await Promise.all([
      db
        .select({
          id: issues.id,
          title: issues.title,
          repoFullName: issues.repoFullName,
          url: issues.url,
        })
        .from(issues)
        .where(ilike(issues.title, searchPattern))
        .limit(5),

      db
        .select({
          githubHandle: profiles.githubHandle,
          displayName: profiles.displayName,
          avatarUrl: profiles.avatarUrl,
          level: profiles.level,
        })
        .from(profiles)
        .where(ilike(profiles.githubHandle, searchPattern))
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
