import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { buildPrRow, isWithinBackfillWindow, type IngestiblePr } from '@/lib/maintainer/pr-ingest';

/**
 * Backfill historic PRs for a newly-installed App or for a newly-added repo
 * inside an existing install. Same upsert shape as the webhook handler — see
 * lib/maintainer/pr-ingest.ts.
 *
 * Triggered from:
 *   - process-installation-event (action='created') → pr-backfill/installation
 *   - process-installation-repos-event (added) → pr-backfill/repo (per repo)
 *   - manual invoke from /maintainer's Refresh PRs button
 *
 * Throttle: 1 repo / 2 seconds to stay well under the install's 5000/hr quota.
 *
 * Window: 30 days, configurable. Anything older is skipped to avoid burning
 * quota on cold repos.
 */

const BACKFILL_WINDOW_DAYS = 30;
const PER_REPO_SLEEP_MS = 2000;

type InstallationEvent = { data: { installationId: number } };
type RepoEvent = { data: { installationId: number; repoFullName: string } };

export const prBackfill = inngest.createFunction(
  { id: 'pr-backfill', concurrency: { key: 'event.data.installationId', limit: 1 } },
  [{ event: 'pr-backfill/installation' }, { event: 'pr-backfill/repo' }],
  async ({ event, step }) => {
    if (event.name === 'pr-backfill/repo') {
      const data = (event as RepoEvent).data;
      return await step.run(`backfill-${data.repoFullName.replace('/', '-')}`, async () =>
        backfillSingleRepo(data.installationId, data.repoFullName),
      );
    }

    // Installation-wide backfill: resolve repos from installation_repositories
    // and process them one at a time, each as its own step.run for Inngest
    // checkpointing.
    const data = (event as InstallationEvent).data;
    const installationId = data.installationId;

    const repos = await step.run('list-repos', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const { data: rows } = await sb
        .from('installation_repositories')
        .select('repo_full_name')
        .eq('installation_id', installationId);
      return (rows ?? []).map((r) => r.repo_full_name);
    });

    const reports: Array<{ repo: string; prs: number; errors: string[] }> = [];
    for (const repo of repos) {
      const report = await step.run(`backfill-${repo.replace('/', '-')}`, async () =>
        backfillSingleRepo(installationId, repo),
      );
      reports.push(report);
      await sleep(PER_REPO_SLEEP_MS);
    }

    return {
      installationId,
      repos: repos.length,
      totalPrs: reports.reduce((acc, r) => acc + r.prs, 0),
      reports: reports.slice(0, 20),
    };
  },
);

async function backfillSingleRepo(
  installationId: number,
  repoFullName: string,
): Promise<{ repo: string; prs: number; errors: string[] }> {
  const errors: string[] = [];
  const sb = getServiceSupabase();
  if (!sb) return { repo: repoFullName, prs: 0, errors: ['service-role missing'] };

  const [owner, name] = repoFullName.split('/');
  if (!owner || !name) return { repo: repoFullName, prs: 0, errors: ['bad repo name'] };

  let octokit;
  try {
    octokit = await getInstallOctokit(installationId);
  } catch (e) {
    return { repo: repoFullName, prs: 0, errors: [`install-token: ${(e as Error).message}`] };
  }

  // Pre-load author handles -> profile id so we can resolve in batch.
  const authorHandleToId = new Map<string, string>();

  const now = Date.now();
  let totalUpserts = 0;

  try {
    const pageIterator = octokit.paginate.iterator(octokit.pulls.list, {
      owner,
      repo: name,
      state: 'all',
      sort: 'updated',
      direction: 'desc',
      per_page: 100,
    });

    outer: for await (const page of pageIterator) {
      for (const pr of page.data) {
        // Stop walking once we pass the window — list is sorted updated desc.
        if (!isWithinBackfillWindow(pr.updated_at, now, BACKFILL_WINDOW_DAYS)) {
          break outer;
        }

        // Resolve author -> profile.
        const handle = pr.user?.login ?? null;
        let authorUserId: string | null = null;
        if (handle) {
          if (authorHandleToId.has(handle)) {
            authorUserId = authorHandleToId.get(handle) ?? null;
          } else {
            const { data: profile } = await sb
              .from('profiles')
              .select('id')
              .eq('github_handle', handle)
              .maybeSingle();
            authorUserId = profile?.id ?? null;
            authorHandleToId.set(handle, authorUserId ?? '');
          }
        }

        const ingestible: IngestiblePr = {
          id: pr.id,
          number: pr.number,
          html_url: pr.html_url,
          title: pr.title,
          body: pr.body ?? null,
          state: pr.state as 'open' | 'closed',
          draft: pr.draft ?? false,
          merged: Boolean(pr.merged_at),
          merged_at: pr.merged_at ?? null,
          closed_at: pr.closed_at ?? null,
          created_at: pr.created_at,
          updated_at: pr.updated_at,
          user: { login: handle ?? 'ghost' },
          base: { repo: { full_name: repoFullName } },
        };

        const row = buildPrRow(ingestible, authorUserId, 'backfill');
        const { error: upsertErr } = await sb
          .from('pull_requests')
          .upsert(row, { onConflict: 'repo_full_name,number' });
        if (upsertErr) {
          errors.push(`upsert #${pr.number}: ${upsertErr.code ?? ''} ${upsertErr.message}`);
          continue;
        }
        totalUpserts += 1;

        // Reviews backfill — limited to most recent 30 to keep API budget tight.
        try {
          const reviewsRes = await octokit.pulls.listReviews({
            owner,
            repo: name,
            pull_number: pr.number,
            per_page: 30,
          });
          await upsertReviews(sb, repoFullName, pr.number, reviewsRes.data);
        } catch (e) {
          errors.push(`reviews #${pr.number}: ${(e as Error).message}`);
        }
      }
    }
  } catch (e) {
    errors.push(`pulls.list: ${(e as Error).message}`);
  }

  return { repo: repoFullName, prs: totalUpserts, errors: errors.slice(0, 10) };
}

async function upsertReviews(
  sb: NonNullable<ReturnType<typeof getServiceSupabase>>,
  repoFullName: string,
  prNumber: number,
  reviews: Array<{
    id: number;
    user: { login: string } | null;
    body: string | null;
    state: string;
    submitted_at?: string | null;
  }>,
): Promise<void> {
  if (reviews.length === 0) return;

  // Find local pr_id.
  const { data: prRow } = await sb
    .from('pull_requests')
    .select('id, mentor_reviewer_id')
    .eq('repo_full_name', repoFullName)
    .eq('number', prNumber)
    .maybeSingle();
  if (!prRow) return;

  // Resolve author level once to compute is_mentor retroactively.
  const { data: authorPr } = await sb
    .from('pull_requests')
    .select('author_user_id')
    .eq('id', prRow.id)
    .maybeSingle();
  let authorLevel = 0;
  if (authorPr?.author_user_id) {
    const { data: authorProfile } = await sb
      .from('profiles')
      .select('level')
      .eq('id', authorPr.author_user_id)
      .maybeSingle();
    authorLevel = authorProfile?.level ?? 0;
  }

  const reviewerCache = new Map<string, { id: string; level: number } | null>();
  for (const r of reviews) {
    const login = r.user?.login;
    if (!login) continue;
    if (!r.submitted_at) continue; // 'pending' reviews

    let reviewer = reviewerCache.get(login);
    if (reviewer === undefined) {
      const { data: row } = await sb
        .from('profiles')
        .select('id, level')
        .eq('github_handle', login)
        .maybeSingle();
      reviewer = row ? { id: row.id, level: row.level ?? 0 } : null;
      reviewerCache.set(login, reviewer);
    }

    const isSelf = login.toLowerCase() === (authorPr?.author_user_id ?? '').toLowerCase();
    const substantive = isSubstantive(r);
    const isMentor = !isSelf && substantive && reviewer !== null && reviewer.level > authorLevel;

    await sb.from('pull_request_reviews').upsert(
      {
        pr_id: prRow.id,
        github_review_id: r.id,
        reviewer_login: login,
        reviewer_user_id: reviewer?.id ?? null,
        state: r.state.toLowerCase() as
          | 'approved'
          | 'changes_requested'
          | 'commented'
          | 'dismissed'
          | 'pending',
        body_excerpt: (r.body ?? '').slice(0, 500) || null,
        is_mentor: isMentor,
        submitted_at: r.submitted_at,
      },
      { onConflict: 'github_review_id' },
    );

    // Retroactively flip mentor_verified for the highest-level mentor.
    if (isMentor && reviewer) {
      let existingMentorLevel = -1;
      if (prRow.mentor_reviewer_id) {
        const { data: m } = await sb
          .from('profiles')
          .select('level')
          .eq('id', prRow.mentor_reviewer_id)
          .maybeSingle();
        existingMentorLevel = m?.level ?? -1;
      }
      if (reviewer.level > existingMentorLevel) {
        await sb
          .from('pull_requests')
          .update({
            mentor_verified: true,
            mentor_reviewer_id: reviewer.id,
            mentor_review_at: r.submitted_at,
          })
          .eq('id', prRow.id);
      }
    }
  }
}

function isSubstantive(review: { state: string; body: string | null }): boolean {
  if (review.state.toLowerCase() === 'changes_requested') return true;
  const body = (review.body ?? '').trim();
  if (body.length < 20) return false;
  const lower = body.toLowerCase();
  if (lower === 'lgtm' || lower === 'looks good to me' || lower === 'looks good') return false;
  return true;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}
