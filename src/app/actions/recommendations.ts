'use server';

import { sql } from 'drizzle-orm';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { tryGetDb, schema } from '@/lib/db/client';
import { rateLimit } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';
import { cacheGet, cacheSet, cacheDel } from '@/lib/cache';
import { filterAndRank, type ScoredIssue } from '@/lib/pipeline/recommend';

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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

  const rateRes = await rateLimit({
    namespace: 'recs:get',
    key: user.id,
    limit: 60,
    windowSec: 60,
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
  const sb = getServerSupabase();
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
    limit: 20,
    windowSec: 60,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true);

  // Atomic claim: the count check and the write are merged into a single UPDATE
  // inside claim_recommendation_atomic (see migration 0012). This eliminates the
  // TOCTOU window that existed when they were separate round-trips -- concurrent
  // requests can no longer both pass a count of 2 and both commit, because the
  // subquery that evaluates the count and the row that gets written are handled
  // atomically by the database engine.
  //
  // Zero rows returned means one of two things: the user already holds 3 active
  // claims, or this specific rec is no longer open. Both outcomes are safe to
  // surface with the same error because the UI re-fetches state after either.
  const { data: rpcData, error: rpcErr } = await service.rpc(
    'claim_recommendation_atomic',
    { p_rec_id: recId, p_user_id: user.id },
  );

  if (rpcErr) return err('persist_failed', rpcErr.message);

  const rows = rpcData as Array<{ id: number }> | null;
  if (!rows || rows.length === 0) {
    return err(
      'claim_limit_or_not_open',
      'claim rejected: you may already have 3 active claims, or this rec is no longer open',
    );
  }

  const claimedId = rows[0].id;

  // Invalidate cache so next dashboard load is fresh.
  await cacheDel(`recs:${user.id}`);

  // Activity log for the transparency tab.
  await service.from('activity_log').insert({
    user_id: user.id,
    kind: 'claim',
    detail: { recId } as never,
  });

  return ok({ id: claimedId });
}

const PR_URL_RE = /^https:\/\/github\.com\/[^/]+\/[^/]+\/pull\/\d+$/;

export async function linkPrToRec(recId: number, prUrl: string): Promise<Result<{ id: number }>> {
  const sb = getServerSupabase();
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
    limit: 10,
    windowSec: 60,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true);

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
): Promise<Result<{ id: number; replacement: RecCard | null }>> {
  const sb = getServerSupabase();
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
    limit: 30,
    windowSec: 60,
  });
  if (!rateRes.ok) return err('rate_limited', 'slow down', true);

  // Atomic skip with the issue id so we know what tier to refill from.
  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ status: 'reassigned' })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'open')
    .select('id, difficulty, issue_id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_skippable', 'rec is not open');

  // Insert a replacement pick. Same difficulty if possible. Excludes
  // anything the user has already seen (any status).
  const replacement = await pickReplacement({
    service,
    userId: user.id,
    preferDifficulty: data.difficulty as 'E' | 'M' | 'H',
  });

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id, replacement });
}

async function pickReplacement(args: {
  service: NonNullable<ReturnType<typeof getServiceSupabase>>;
  userId: string;
  preferDifficulty: 'E' | 'M' | 'H';
}): Promise<RecCard | null> {
  const { service, userId, preferDifficulty } = args;

  const { data: seen } = await service
    .from('recommendations')
    .select('issue_id')
    .eq('user_id', userId);
  const excludeIds = new Set((seen ?? []).map((r) => r.issue_id));

  // Try same tier first, then any tier. Health >= 40 filter mirrors filterAndRank.
  for (const where of [{ difficulty: preferDifficulty }, {} as Record<string, string>]) {
    let q = service
      .from('issues')
      .select('id, repo_full_name, github_issue_number, title, difficulty, xp_reward, url')
      .eq('state', 'open')
      .gte('repo_health_score', 40)
      .order('scored_at', { ascending: false })
      .limit(50);
    if (where.difficulty) q = q.eq('difficulty', where.difficulty);
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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

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
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured');
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role missing');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'sign in first');

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

// Used by tests + the unused-export linter — keeps the type alive even if not
// referenced from a UI yet during Phase 2 wiring.
export type { ScoredIssue };
