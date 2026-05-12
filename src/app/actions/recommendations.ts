'use server';

import { sql } from 'drizzle-orm';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getDb, schema } from '@/lib/db/client';
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
  const db = getDb();
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

  // Atomic claim: UPDATE ... WHERE status='open' AND user_id=auth.uid()
  // Zero rows affected = already claimed or doesn't exist.
  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ status: 'claimed', claimed_at: new Date().toISOString() })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('already_claimed', 'this rec is no longer open');

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

export async function skipRecommendation(recId: number): Promise<Result<{ id: number }>> {
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

  const { data, error: updateErr } = await service
    .from('recommendations')
    .update({ status: 'reassigned' })
    .eq('id', recId)
    .eq('user_id', user.id)
    .eq('status', 'open')
    .select('id')
    .maybeSingle();

  if (updateErr) return err('persist_failed', updateErr.message);
  if (!data) return err('not_skippable', 'rec is not open');

  await cacheDel(`recs:${user.id}`);
  return ok({ id: data.id });
}

// Used by tests + the unused-export linter — keeps the type alive even if not
// referenced from a UI yet during Phase 2 wiring.
export type { ScoredIssue };
