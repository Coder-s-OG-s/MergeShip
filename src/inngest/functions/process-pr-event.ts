import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_SOURCE, xpForMerge, refIds } from '@/lib/xp/sources';
import { cacheDelByPrefix } from '@/lib/cache';
import { buildPrRow, type IngestiblePr } from '@/lib/maintainer/pr-ingest';

/**
 * Webhook handler for GitHub `pull_request` events.
 *
 * On `pull_request.closed` with `merged=true`:
 *   1. Find a claimed recommendation whose linked_pr_url matches this PR
 *   2. UPSERT xp_events (UNIQUE prevents replay)
 *   3. Mark recommendation completed
 *   4. Trigger handles xp + level recompute (DB-side); we just clear caches
 *
 * On `pull_request.opened`: tries to link to an existing open claim via the
 * issue reference in the PR body (#123, closes #123, fixes #123).
 *
 * Idempotency: webhook_deliveries dedupes at the route layer; we additionally
 * rely on the xp_events UNIQUE(user_id, source, ref_id) constraint here.
 */

type PrPayload = {
  action:
    | 'opened'
    | 'closed'
    | 'reopened'
    | 'edited'
    | 'synchronize'
    | 'ready_for_review'
    | 'converted_to_draft'
    | string;
  pull_request: {
    id: number;
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    state: 'open' | 'closed';
    draft: boolean;
    merged: boolean;
    merged_at: string | null;
    closed_at: string | null;
    created_at: string;
    updated_at: string;
    user: { login: string };
    base: { repo: { full_name: string } };
  };
};

const ISSUE_REF = /(?:close[sd]?|fixe[sd]?|resolve[sd]?)\s+#(\d+)|#(\d+)/gi;

export function extractIssueNumbers(text: string | null | undefined): number[] {
  if (!text) return [];
  const found = new Set<number>();
  for (const m of text.matchAll(ISSUE_REF)) {
    const n = parseInt(m[1] ?? m[2] ?? '', 10);
    if (Number.isFinite(n)) found.add(n);
  }
  return [...found];
}

export const processPrEvent = inngest.createFunction(
  {
    id: 'process-pr-event',
    retries: 3,
    concurrency: {
      key: 'event.data.payload.pull_request.html_url',
      limit: 1,
    },
  },
  { event: 'github/pull_request' },
  async ({ event, step, attempt }) => {
    const data = event.data as { payload: PrPayload };
    const pr = data.payload.pull_request;
    const action = data.payload.action;
    const repo = pr.base.repo.full_name;
    const prUrl = pr.html_url;
    try {
      await step.run('upsert-pr-row', async () => {
        await upsertPrRow(repo, pr, action);
        return { ok: true };
      });
      if (action === 'opened') {
        return await step.run('link-pr-to-claim', async () => linkPrToClaim(prUrl, repo, pr));
      }
      if (action === 'closed' && pr.merged === true) {
        return await step.run('handle-merge', async () => handleMerge(prUrl, repo, pr));
      }
      return { skipped: true, action };
    } catch (err) {
      const sb = getServiceSupabase();

      if (sb) {
        const { error: insertError } = await sb.from('failed_webhook_events').insert({
          delivery_id: event.data.deliveryId,
          event_type: 'github/pull_request',
          source: 'inngest',
          payload: event.data,
          error: (err as Error).message,
          retry_count: attempt,
        });
        if (insertError) {
          console.error('failed to record dead-letter event:', insertError.message);
        }
      }

      throw err; // IMPORTANT → keeps Inngest retry working
    }
  },
);

async function upsertPrRow(
  repo: string,
  pr: PrPayload['pull_request'],
  action: string,
): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;

  // Only mirror PRs in repos we actually have install access to. Stops us
  // polluting the table if a misconfigured webhook ever reaches us.
  const { data: knownRepo } = await sb
    .from('installation_repositories')
    .select('repo_full_name')
    .eq('repo_full_name', repo)
    .limit(1)
    .maybeSingle();
  if (!knownRepo) return;

  // Author lookup is a best-effort link to the MergeShip profile by handle.
  const { data: authorProfile } = await sb
    .from('profiles')
    .select('id')
    .eq('github_handle', pr.user.login)
    .maybeSingle();

  await sb
    .from('pull_requests')
    .upsert(buildPrRow(pr as IngestiblePr, authorProfile?.id ?? null, action), {
      onConflict: 'repo_full_name,number',
    });
}

async function linkPrToClaim(
  prUrl: string,
  repo: string,
  pr: PrPayload['pull_request'],
): Promise<{ linked: boolean; recId?: number }> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error('service role missing');

  const issueRefs = [...extractIssueNumbers(pr.body), ...extractIssueNumbers(pr.title)];
  if (issueRefs.length === 0) return { linked: false };

  // Find a claim whose issue is referenced AND belongs to the PR author.
  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('github_handle', pr.user.login)
    .maybeSingle();
  if (!profile) return { linked: false };

  const { data: claims } = await sb
    .from('recommendations')
    .select('id, issue_id, issues!inner(repo_full_name, github_issue_number)')
    .eq('user_id', profile.id)
    .eq('status', 'claimed')
    .is('linked_pr_url', null);

  for (const claim of claims ?? []) {
    const issuesField = claim['issues'] as unknown as {
      repo_full_name: string;
      github_issue_number: number;
    };
    const issue = issuesField;
    if (!issue) continue;
    if (issue.repo_full_name === repo && issueRefs.includes(issue.github_issue_number)) {
      await sb.from('recommendations').update({ linked_pr_url: prUrl }).eq('id', claim.id);
      return { linked: true, recId: claim.id };
    }
  }
  return { linked: false };
}

async function handleMerge(
  prUrl: string,
  repo: string,
  pr: PrPayload['pull_request'],
): Promise<{ xpAwarded: boolean; recId?: number; reason?: string }> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error('service role missing');

  // First try the linked rec.
  const { data: rec } = await sb
    .from('recommendations')
    .select('id, user_id, difficulty, xp_reward, status')
    .eq('linked_pr_url', prUrl)
    .maybeSingle();

  if (rec) {
    if (rec.status === 'completed') return { xpAwarded: false, recId: rec.id };
    return await awardRecommendedMerge(sb, rec, repo, pr);
  }

  // No linked rec — the common case is the user opened the PR before
  // clicking Claim, so pull_request.opened ran with no claim to link to.
  // Retry the link logic now using the PR body/title issue refs.
  const linkedId = await tryLinkByIssueRef(sb, repo, pr);
  if (linkedId) {
    const { data: relinked } = await sb
      .from('recommendations')
      .select('id, user_id, difficulty, xp_reward, status')
      .eq('id', linkedId)
      .maybeSingle();
    if (relinked && relinked.status !== 'completed') {
      await sb.from('recommendations').update({ linked_pr_url: prUrl }).eq('id', linkedId);
      return await awardRecommendedMerge(sb, relinked, repo, pr);
    }
  }

  // Truly unrecommended. Anti-abuse: no XP when the author merges into
  // their own repo (doc rule — self-actions on own repo don't count).
  const repoOwner = repo.split('/')[0]?.toLowerCase();
  const author = pr.user.login.toLowerCase();
  if (repoOwner === author) return { xpAwarded: false, reason: 'self_merge' };

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('github_handle', pr.user.login)
    .maybeSingle();
  if (!profile) return { xpAwarded: false };
  await insertXpEvent({
    userId: profile.id,
    source: XP_SOURCE.UNRECOMMENDED_MERGE,
    refType: 'pr',
    refId: refIds.pr(repo, pr.number),
    repo,
    xpDelta: 5,
  });
  return { xpAwarded: true };
}

async function awardRecommendedMerge(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  rec: { id: number; user_id: string; difficulty: string; xp_reward: number | null },
  repo: string,
  pr: PrPayload['pull_request'],
): Promise<{ xpAwarded: boolean; recId: number }> {
  const difficulty = rec.difficulty as 'E' | 'M' | 'H';
  const existing = await sb
    .from('xp_events')
    .select('id')
    .eq('user_id', rec.user_id)
    .eq('ref_id', refIds.pr(repo, pr.number))
    .maybeSingle();
  if (existing?.data) {
    return { xpAwarded: false, recId: rec.id };
  }
  const inserted = await insertXpEvent({
    userId: rec.user_id,
    source: XP_SOURCE.RECOMMENDED_MERGE,
    refType: 'pr',
    refId: refIds.pr(repo, pr.number),
    repo,
    difficulty,
    xpDelta: rec.xp_reward ?? xpForMerge(difficulty),
  });

  await sb
    .from('recommendations')
    .update({ status: 'completed', completed_at: new Date().toISOString() })
    .eq('id', rec.id);

  await cacheDelByPrefix(`recs:${rec.user_id}`);
  await cacheDelByPrefix(`profile:public:`);
  await cacheDelByPrefix(`leaderboard:`);

  if (inserted) {
    await sb.from('activity_log').insert({
      user_id: rec.user_id,
      kind: 'pr_merged',
      detail: { recId: rec.id, repo, prNumber: pr.number, xpAwarded: rec.xp_reward } as never,
    });
  }

  return { xpAwarded: inserted, recId: rec.id };
}

async function tryLinkByIssueRef(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  repo: string,
  pr: PrPayload['pull_request'],
): Promise<number | null> {
  const issueRefs = [...extractIssueNumbers(pr.body), ...extractIssueNumbers(pr.title)];
  if (issueRefs.length === 0) return null;

  const { data: profile } = await sb
    .from('profiles')
    .select('id')
    .eq('github_handle', pr.user.login)
    .maybeSingle();
  if (!profile) return null;

  const { data: claims } = await sb
    .from('recommendations')
    .select('id, issues!inner(repo_full_name, github_issue_number)')
    .eq('user_id', profile.id)
    .in('status', ['open', 'claimed']);

  for (const claim of claims ?? []) {
    // Supabase types the joined `issues` field as an array even for a
    // single-row !inner join. Normalise.
    const raw = (claim as unknown as { issues: unknown }).issues;
    const issue = Array.isArray(raw)
      ? (raw[0] as { repo_full_name?: string; github_issue_number?: number } | undefined)
      : (raw as { repo_full_name?: string; github_issue_number?: number } | undefined);
    if (!issue?.repo_full_name || typeof issue.github_issue_number !== 'number') continue;
    if (issue.repo_full_name === repo && issueRefs.includes(issue.github_issue_number)) {
      return (claim as { id: number }).id;
    }
  }
  return null;
}
