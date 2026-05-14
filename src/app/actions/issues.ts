'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { ok, err, type Result } from '@/lib/result';
import { rateLimit } from '@/lib/rate-limit';
import { cacheDel } from '@/lib/cache';

const PAGE_SIZE = 10;

export type IssueFilter = {
  search?: string;
  state?: 'open' | 'closed';
  difficulty?: 'E' | 'M' | 'H';
  repo?: string;
  showClaimed?: boolean;
  page?: number;
};

export type IssueWithStatus = {
  id: number;
  repoFullName: string;
  githubIssueNumber: number;
  title: string;
  difficulty: 'E' | 'M' | 'H' | null;
  xpReward: number | null;
  labels: string[] | null;
  state: 'open' | 'closed';
  url: string;
  fetchedAt: string;
  userRecId: number | null;
  userRecStatus: 'open' | 'claimed' | 'completed' | 'expired' | 'reassigned' | null;
};

export type IssuesPageResult = {
  issues: IssueWithStatus[];
  total: number;
  page: number;
  pageSize: number;
};

export type RepoOption = {
  label: string; // user's repo name (fork name if forked)
  value: string; // upstream repo name to filter issues by
};

export async function getRepoOptions(): Promise<Result<RepoOption[]>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const { data: insts } = await service
    .from('github_installations')
    .select('id')
    .eq('user_id', user.id);

  const instIds = (insts ?? []).map((i: { id: number }) => i.id);
  if (instIds.length === 0) return ok([]);

  const { data: repoRows } = await service
    .from('installation_repositories')
    .select('repo_full_name')
    .in('installation_id', instIds);

  const userRepos = [
    ...new Set((repoRows ?? []).map((r: { repo_full_name: string }) => r.repo_full_name)),
  ];
  if (userRepos.length === 0) return ok([]);

  // Get provider token so we can call GitHub API to detect forks
  const sessionRes = await sb.auth.getSession();
  const token = sessionRes.data.session?.provider_token;

  // Resolve each repo: if it's a fork, use the upstream (parent) as the issues source
  const options = await Promise.all(
    userRepos.map(async (repo): Promise<RepoOption> => {
      if (!token) return { label: repo, value: repo };
      try {
        const res = await fetch(`https://api.github.com/repos/${repo}`, {
          headers: {
            Authorization: `Bearer ${token}`,
            Accept: 'application/vnd.github+json',
            'X-GitHub-Api-Version': '2022-11-28',
          },
        });
        if (!res.ok) return { label: repo, value: repo };
        const data = (await res.json()) as { fork?: boolean; parent?: { full_name: string } };
        if (data.fork && data.parent?.full_name) {
          return { label: repo, value: data.parent.full_name };
        }
        return { label: repo, value: repo };
      } catch {
        return { label: repo, value: repo };
      }
    }),
  );

  // Deduplicate by value (multiple forks of same upstream → one entry)
  const seen = new Set<string>();
  const deduped = options
    .filter((opt) => {
      if (seen.has(opt.value)) return false;
      seen.add(opt.value);
      return true;
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  return ok(deduped);
}

export async function getIssuesPage(filters: IssueFilter): Promise<Result<IssuesPageResult>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const page = Math.max(1, filters.page ?? 1);
  const from = (page - 1) * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  let query = service
    .from('issues')
    .select(
      'id, repo_full_name, github_issue_number, title, difficulty, xp_reward, labels, state, url, fetched_at',
      { count: 'exact' },
    )
    .eq('state', filters.state ?? 'open')
    .order('fetched_at', { ascending: false })
    .range(from, to);

  if (filters.search?.trim()) {
    query = query.ilike('title', `%${filters.search.trim()}%`);
  }
  if (filters.difficulty) {
    query = query.eq('difficulty', filters.difficulty);
  }
  if (filters.repo) {
    query = query.eq('repo_full_name', filters.repo);
  }

  const { data, count, error } = await query;
  if (error) return err('db_error', error.message);

  const rows = (data ?? []) as {
    id: number;
    repo_full_name: string;
    github_issue_number: number;
    title: string;
    difficulty: string | null;
    xp_reward: number | null;
    labels: string[] | null;
    state: string;
    url: string;
    fetched_at: string;
  }[];

  const issueIds = rows.map((i) => i.id);
  const recMap = new Map<number, { id: number; status: string }>();
  if (issueIds.length > 0) {
    const { data: recsData } = await service
      .from('recommendations')
      .select('id, issue_id, status')
      .eq('user_id', user.id)
      .in('issue_id', issueIds);
    for (const r of recsData ?? []) {
      recMap.set(r.issue_id, { id: r.id, status: r.status });
    }
  }

  let issues: IssueWithStatus[] = rows.map((i) => {
    const rec = recMap.get(i.id) ?? null;
    return {
      id: i.id,
      repoFullName: i.repo_full_name,
      githubIssueNumber: i.github_issue_number,
      title: i.title,
      difficulty: i.difficulty as 'E' | 'M' | 'H' | null,
      xpReward: i.xp_reward,
      labels: i.labels,
      state: i.state as 'open' | 'closed',
      url: i.url,
      fetchedAt: i.fetched_at,
      userRecId: rec?.id ?? null,
      userRecStatus: (rec?.status ?? null) as IssueWithStatus['userRecStatus'],
    };
  });

  if (!filters.showClaimed) {
    issues = issues.filter((i) => i.userRecStatus !== 'claimed');
  }

  return ok({ issues, total: count ?? 0, page, pageSize: PAGE_SIZE });
}

export async function claimIssue(issueId: number): Promise<Result<{ recId: number }>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'issues:claim',
    key: user.id,
    limit: 20,
    windowSec: 60,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true);

  const { data: issue } = await service
    .from('issues')
    .select('id, difficulty, xp_reward')
    .eq('id', issueId)
    .single();
  if (!issue) return err('not_found', 'issue not found');

  const { data: existing } = await service
    .from('recommendations')
    .select('id, status')
    .eq('user_id', user.id)
    .eq('issue_id', issueId)
    .maybeSingle();

  if (existing) {
    if (existing.status === 'claimed') return ok({ recId: existing.id });
    if (existing.status === 'open') {
      const { data: updated } = await service
        .from('recommendations')
        .update({ status: 'claimed', claimed_at: new Date().toISOString() })
        .eq('id', existing.id)
        .select('id')
        .single();
      if (!updated) return err('persist_failed', 'claim failed');
      await cacheDel(`recs:${user.id}`);
      return ok({ recId: updated.id });
    }
    return err('not_claimable', `status is ${existing.status}`);
  }

  const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
  const now = new Date().toISOString();
  const { data: inserted, error: insertErr } = await service
    .from('recommendations')
    .insert({
      user_id: user.id,
      issue_id: issueId,
      difficulty: issue.difficulty ?? 'E',
      xp_reward: issue.xp_reward ?? 50,
      recommended_at: now,
      expires_at: expiresAt,
      claimed_at: now,
      status: 'claimed',
    })
    .select('id')
    .single();

  if (insertErr) return err('persist_failed', insertErr.message);
  if (!inserted) return err('persist_failed', 'insert returned no data');

  await cacheDel(`recs:${user.id}`);
  await service.from('activity_log').insert({
    user_id: user.id,
    kind: 'claim',
    detail: { issueId } as never,
  });

  return ok({ recId: inserted.id });
}

export async function unclaimIssue(recId: number): Promise<Result<void>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'issues:unclaim',
    key: user.id,
    limit: 20,
    windowSec: 60,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true);

  const { data, error } = await service
    .from('recommendations')
    .update({ status: 'open', claimed_at: null })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .select('id')
    .maybeSingle();

  if (error) return err('persist_failed', error.message);
  if (!data) return err('not_found', 'no claimed recommendation found');

  await cacheDel(`recs:${user.id}`);
  return ok(undefined);
}
