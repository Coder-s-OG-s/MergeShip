/**
 * Shared PR ingestion logic — webhook handler AND pr-backfill use the same
 * upsert shape so the two paths can't drift.
 */

export type IngestiblePr = {
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

/**
 * Webhook action and pr.state may not agree (e.g., synchronize on a closed
 * PR, edited after merge). This collapses both signals into our enum:
 * 'open' | 'closed' | 'merged'.
 */
export function derivePrState(
  pr: Pick<IngestiblePr, 'state' | 'merged' | 'merged_at'>,
  action: string,
): 'open' | 'closed' | 'merged' {
  if (action === 'closed') {
    return pr.merged === true ? 'merged' : 'closed';
  }
  if (pr.merged === true) return 'merged';
  if (pr.state === 'closed') return pr.merged_at ? 'merged' : 'closed';
  return 'open';
}

/**
 * Backfill cutoff. We stop ingesting when we hit a PR older than this so a
 * decade-old repo doesn't burn quota.
 */
export function isWithinBackfillWindow(iso: string, nowMs: number, windowDays: number): boolean {
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return false;
  return nowMs - t <= windowDays * 24 * 3600 * 1000;
}

/**
 * Shape we upsert into `pull_requests`. The webhook handler and backfill
 * build this from different sources but the row layout is identical.
 */
export type PullRequestUpsertRow = {
  github_pr_id: number;
  repo_full_name: string;
  number: number;
  title: string;
  body_excerpt: string | null;
  author_login: string;
  author_user_id: string | null;
  state: 'open' | 'closed' | 'merged';
  draft: boolean;
  url: string;
  github_created_at: string;
  github_updated_at: string;
  merged_at: string | null;
  closed_at: string | null;
  fetched_at: string;
};

export function buildPrRow(
  pr: IngestiblePr,
  authorUserId: string | null,
  action: string,
): PullRequestUpsertRow {
  return {
    github_pr_id: pr.id,
    repo_full_name: pr.base.repo.full_name,
    number: pr.number,
    title: pr.title,
    body_excerpt: (pr.body ?? '').slice(0, 500) || null,
    author_login: pr.user.login,
    author_user_id: authorUserId,
    state: derivePrState(pr, action),
    draft: pr.draft === true,
    url: pr.html_url,
    github_created_at: pr.created_at,
    github_updated_at: pr.updated_at,
    merged_at: pr.merged_at,
    closed_at: pr.closed_at,
    fetched_at: new Date().toISOString(),
  };
}
