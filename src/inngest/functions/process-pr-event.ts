import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { insertXpEvent } from '@/lib/xp/events';
import { XP_SOURCE, xpForMerge, refIds } from '@/lib/xp/sources';
import { cacheDelByPrefix } from '@/lib/cache';

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
  action: 'opened' | 'closed' | 'reopened' | 'edited' | string;
  pull_request: {
    number: number;
    html_url: string;
    title: string;
    body: string | null;
    merged: boolean;
    merged_at: string | null;
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
    concurrency: { key: 'event.data.payload.pull_request.html_url', limit: 1 },
  },
  { event: 'github/pull_request' },
  async ({ event, step }) => {
    const data = event.data as { payload: PrPayload };
    const pr = data.payload.pull_request;
    const action = data.payload.action;
    const repo = pr.base.repo.full_name;
    const prUrl = pr.html_url;

    if (action === 'opened') {
      return await step.run('link-pr-to-claim', async () => linkPrToClaim(prUrl, repo, pr));
    }

    if (action === 'closed' && pr.merged === true) {
      return await step.run('handle-merge', async () => handleMerge(prUrl, repo, pr));
    }

    return { skipped: true, action };
  },
);

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
): Promise<{ xpAwarded: boolean; recId?: number }> {
  const sb = getServiceSupabase();
  if (!sb) throw new Error('service role missing');

  // Find the recommendation linked to this PR.
  const { data: rec } = await sb
    .from('recommendations')
    .select('id, user_id, difficulty, xp_reward, status')
    .eq('linked_pr_url', prUrl)
    .maybeSingle();

  if (!rec) {
    // unrecommended merge — small XP if the author exists.
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

  if (rec.status === 'completed') return { xpAwarded: false, recId: rec.id };

  const difficulty = rec.difficulty as 'E' | 'M' | 'H';
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

  if (inserted) {
    await sb.from('activity_log').insert({
      user_id: rec.user_id,
      kind: 'pr_merged',
      detail: { recId: rec.id, repo, prNumber: pr.number, xpAwarded: rec.xp_reward } as never,
    });
  }

  return { xpAwarded: inserted, recId: rec.id };
}
