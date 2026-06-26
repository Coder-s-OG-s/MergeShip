'use server';

import { sql } from 'drizzle-orm';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { tryGetDb, schema } from '@/lib/db/client';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache';
import { filterAndRank, type ScoredIssue } from '@/lib/pipeline/recommend';
import { getAllowedDifficulties } from '@/lib/pipeline/difficulty';

/**
 * Server actions for the recommendation lifecycle.
 *
 * Atomicity guarantees:
 *   - claim uses a single UPDATE ... WHERE status='open' so concurrent claims
 *     deterministically fail one path (zero rows affected).
 *   - skip is similar — only flips status if the rec is still 'open'.
 */

const RECS_CACHE_TTL_S = 60 * 60; // 1h
const RECS_PER_PAGE = 8;

export type RecCard = {
  id: number;
  issueId: number;
  repoFullName: string;
  issueNumber: number;
  title: string;
  difficulty: 'E' | 'M' | 'H';
  xpReward: number;
  url: string;
  status: 'open' | 'claimed' | 'completed' | 'expired' | 'reassigned';
};

export async function getRecommendations(): Promise<Result<RecCard[]>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:get',
    key: user.id,
    ...RATE_LIMIT_TIERS.GENEROUS,
  });
  if (!rateRes.ok) return err('rate_limited', 'too many requests', true);

  const cacheKey = `recs:${user.id}`;
  const cached = await cacheGet<RecCard[]>(cacheKey);
  if (cached) return ok(cached);

  // Phase 2: pull recs that already exist in the DB. The background sweep that
  // populates the recs table is wired in a separate Inngest function.
  const db = tryGetDb();
  if (!db) return ok([]);
  const rows = await db
    .select({
      id: schema.recommendations.id,
      issueId: schema.recommendations.issueId,
      difficulty: schema.recommendations.difficulty,
      xpReward: schema.recommendations.xpReward,
      status: schema.recommendations.status,
      repoFullName: schema.issues.repoFullName,
      issueNumber: schema.issues.githubIssueNumber,
      title: schema.issues.title,
      url: schema.issues.url,
    })
    .from(schema.recommendations)
    .innerJoin(schema.issues, sql`${schema.recommendations.issueId} = ${schema.issues.id}`)
    .where(
      sql`${schema.recommendations.userId} = ${user.id} AND ${schema.recommendations.status} IN ('open','claimed')`,
    )
    .orderBy(sql`${schema.recommendations.recommendedAt} desc`)
    .limit(RECS_PER_PAGE);

  const cards: RecCard[] = rows.map((r) => ({
    id: r.id,
    issueId: r.issueId,
    repoFullName: r.repoFullName,
    issueNumber: r.issueNumber,
    title: r.title,
    difficulty: r.difficulty as 'E' | 'M' | 'H',
    xpReward: r.xpReward,
    url: r.url,
    status: r.status as RecCard['status'],
  }));

  await cacheSet(cacheKey, cards, RECS_CACHE_TTL_S);
  return ok(cards);
}

export async function claimRecommendation(recId: number): Promise<Result<{ id: number }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:claim',
    key: user.id,
    ...RATE_LIMIT_TIERS.MEDIUM,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true, rateRes.resetAt);

  // Fast pre-check: reject early if the user is obviously at the limit.
  // This is not authoritative — two concurrent requests can both pass it —
  // but it avoids unnecessary write attempts under normal conditions.
  const now = new Date().toISOString();
  const { count: preCount } = await service
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .gte('expires_at', now);
  if ((preCount ?? 0) >= 3) {
    return err('claim_limit', 'you already have 3 active claims - merge or close them first');
  }

  // Optimistic atomic claim: UPDATE ... WHERE status='open'.
  // The WHERE status='open' guard is atomic at the database level so only one
  // concurrent request can claim a given rec. However, two requests targeting
  // different recs can both succeed when the user is near the limit.
  const claimedAt = new Date().toISOString();
  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ status: 'claimed', claimed_at: claimedAt })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('already_claimed', 'this rec is no longer open');

  // Post-claim verification: count active claims now that this write has
  // committed. If the count exceeds 3 (two concurrent requests both slipped
  // through the pre-check above), revert this claim immediately.
  const { count: postCount } = await service
    .from('recommendations')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .gte('expires_at', now);
  if ((postCount ?? 0) > 3) {
    await service
      .from('recommendations')
      .update({ status: 'open', claimed_at: null })
      .eq('id', recId)
      .eq('user_id', user.id)
      .eq('status', 'claimed');
    return err('claim_limit', 'you already have 3 active claims - merge or close them first');
  }

  // Invalidate cache so next dashboard load is fresh.
  await cacheDel(`recs:${user.id}`);

  // Activity log for the transparency tab.
  await service.from('activity_log').insert({
    user_id: user.id,
    kind: 'claim',
    detail: { recId } as never,
  });

  return ok({ id: data.id });
}

const PR_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

export async function linkPrToRec(recId: number, prUrl: string): Promise<Result<{ id: number }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const trimmed = prUrl.trim();
  if (!PR_URL_RE.test(trimmed)) {
    return err('invalid_url', 'paste a full https://github.com/<owner>/<repo>/pull/<n> URL');
  }

  const rateRes = await rateLimit({
    namespace: 'recs:link-pr',
    key: user.id,
    ...RATE_LIMIT_TIERS.STRICT,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true, rateRes.resetAt);

  // Security: verify the authenticated user actually authored this PR.
  const sessionRes = await sb.auth.getSession();
  const token = sessionRes.data.session?.provider_token;
  if (!token) return err('no_github_token', 'reconnect your GitHub account');

  const match = trimmed.match(/^https:\/\/github\.com\/([^/]+)\/([^/]+)\/pull\/(\d+)$/);
  if (!match)
    return err('invalid_url', 'paste a full https://github.com/<owner>/<repo>/pull/<n> URL');
  const [, owner, repo, number] = match;

  const ghRes = await fetch(`https://api.github.com/repos/${owner}/${repo}/pulls/${number}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!ghRes.ok)
    return err('github_fetch_failed', 'could not fetch PR from GitHub — check the URL');

  const prData = (await ghRes.json()) as { user?: { login?: string } };
  const prAuthorLogin = prData.user?.login?.toLowerCase();

  const { data: profile } = await service
    .from('profiles')
    .select('github_handle')
    .eq('id', user.id)
    .single();
  const userHandle = profile?.github_handle?.toLowerCase();

  if (!prAuthorLogin || !userHandle || prAuthorLogin !== userHandle) {
    return err('not_your_pr', 'you can only link PRs you authored');
  }

  // Only allow linking to a claim the user owns.
  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ linked_pr_url: trimmed })
    .eq('id', recId)
    .eq('user_id', user.id)
    .in('status', ['open', 'claimed'])
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_linkable', 'rec is not open or claimed');

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id });
}

export async function skipRecommendation(
  recId: number,
  skipReason?: string,
): Promise<Result<{ id: number; replacement: RecCard | null }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:skip',
    key: user.id,
    ...RATE_LIMIT_TIERS.STANDARD,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true, rateRes.resetAt);

  // Atomic skip with the issue id so we know what tier to refill from.
  // Persist the optional skip_reason alongside the status change.
  const updatePayload: Record<string, unknown> = { status: 'reassigned' };
  if (skipReason?.trim()) {
    updatePayload.skip_reason = skipReason.trim().slice(0, 500);
  }
  const { data, error: updateErr } = await service
    .from('recommendations')
    .update(updatePayload)
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'open')
    .select('id, difficulty, issue_id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_skippable', 'rec is not open');

  // Insert a replacement pick. Same difficulty if possible. Excludes
  // anything the user has already seen (any status).
  const { data: profile } = await service
    .from('profiles')
    .select('level')
    .eq('id', user.id)
    .maybeSingle();
  const userLevel = profile?.level ?? 0;

  const replacement = await pickReplacement({
    service,
    userId: user.id,
    preferDifficulty: data.difficulty as 'E' | 'M' | 'H',
    userLevel,
  });

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id, replacement });
}

async function pickReplacement(args: {
  service: NonNullable<ReturnType<typeof getServiceSupabase>>;
  userId: string;
  preferDifficulty: 'E' | 'M' | 'H';
  userLevel: number;
}): Promise<RecCard | null> {
  const { service, userId, preferDifficulty, userLevel } = args;
  const allowedDifficulties = getAllowedDifficulties(userLevel);

  const { data: seen } = await service
    .from('recommendations')
    .select('issue_id')
    .eq('user_id', userId);
  const excludeIds = new Set((seen ?? []).map((r) => r.issue_id));

  // Try same tier first, then any tier. Health >= 40 filter mirrors filterAndRank.
  for (const where of [{ difficulty: preferDifficulty }, null]) {
    const q = service
      .from('issues')
      .select('id, repo_full_name, github_issue_number, title, difficulty, xp_reward, url')
      .eq('state', 'open')
      .gte('repo_health_score', 40)
      .in('difficulty', where ? [where.difficulty] : allowedDifficulties)
      .order('scored_at', { ascending: false })
      .limit(50);
    const { data: pool } = await q;
    const pick = (pool ?? []).find((i) => !excludeIds.has(i.id));
    if (!pick) continue;

    const expiresAt = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();
    const { data: inserted } = await service
      .from('recommendations')
      .insert({
        user_id: userId,
        issue_id: pick.id,
        difficulty: pick.difficulty,
        xp_reward: pick.xp_reward,
        recommended_at: new Date().toISOString(),
        expires_at: expiresAt,
        status: 'open',
      })
      .select('id')
      .single();
    if (!inserted) return null;
    return {
      id: inserted.id,
      issueId: pick.id,
      repoFullName: pick.repo_full_name,
      issueNumber: pick.github_issue_number,
      title: pick.title,
      difficulty: pick.difficulty as 'E' | 'M' | 'H',
      xpReward: pick.xp_reward,
      url: pick.url,
      status: 'open',
    };
  }
  return null;
}

export async function unlinkPrFromRec(recId: number): Promise<Result<{ id: number }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:unlink-pr',
    key: user.id,
    ...RATE_LIMIT_TIERS.MEDIUM,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true, rateRes.resetAt);

  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ linked_pr_url: null })
    .eq('id', recId)
    .eq('user_id', user.id)
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_found', 'recommendation not found');

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id });
}

export async function unclaimRecommendation(recId: number): Promise<Result<{ id: number }>> {
  const sb = await getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:unclaim',
    key: user.id,
    ...RATE_LIMIT_TIERS.MEDIUM,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true, rateRes.resetAt);

  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ status: 'open', claimed_at: null, linked_pr_url: null })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_claimable', 'recommendation is not claimed');

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id });
}
