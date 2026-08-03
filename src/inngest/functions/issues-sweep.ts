import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { checkRateBudget } from '@/lib/github/rate-budget';
import { scoreDifficulty, repoHealth } from '@/lib/pipeline/score';
import { fetchRepoMetrics } from '@/lib/github/repo-meta';
import { llmCall } from '@/lib/llm/router';
import { DifficultySchema } from '@/lib/llm/schemas';
import { getSyncCursor, setSyncCursor, clearSyncCursor } from '@/lib/maintainer/sync-cursor';

/**
 * Pulls open issues from every active GitHub App install, scores difficulty,
 * upserts into the issues table.
 *
 * Cron: every 12 hours. The function is split into named steps so the run
 * trace shows where rows drop. Each step returns counts + a sample so a
 * single Inngest run trace tells us exactly what's happening.
 *
 * Cost bounds (per run):
 *   - installs capped (rotated round-robin by least-recently-swept)
 *   - repos per install capped (rotated round-robin by least-recently-swept)
 *   - issues per install and per sweep capped
 *   - issues scored within the last 24h are skipped (scored_at cooldown)
 *   - each repo is its own step.run so a failure only retries that repo
 */

const MAX_INSTALLS_PER_SWEEP = 50;
const MAX_REPOS_PER_INSTALL = 20;
const MAX_ISSUES_PER_INSTALL = 100;
const MAX_ISSUES_PER_SWEEP = 1000;
const ISSUES_PER_REPO_PAGE = 30;
const SCORE_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const SYNC_TYPE = 'issues_sweep';

type RepoRow = { repo_full_name: string };

type RepoReport = {
  repo: string;
  target: string;
  skipped: boolean;
  targets: number;
  sampleTargets: string[];
  issues: number;
  upserts: number;
  errors: string[];
};

export const issuesSweep = inngest.createFunction(
  {
    id: 'issues-sweep',
    // Overlapping sweeps would double GitHub + LLM spend, so only one run at
    // a time (cron is every 12h and each run is capped, so it always drains).
    concurrency: { key: 'issues-sweep', limit: 1 },
  },
  { cron: '0 */12 * * *' },
  async ({ step }) => {
    const installs = await step.run('list-installs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const { data } = await sb
        .from('github_installations')
        .select('id, account_login')
        .is('uninstalled_at', null)
        .is('suspended_at', null)
        // Least-recently-swept first so every install rotates through the cap
        // instead of the same top-50 by id being swept every run.
        .order('last_swept_at', { ascending: true, nullsFirst: true })
        .order('id', { ascending: true })
        .limit(MAX_INSTALLS_PER_SWEEP);
      return data ?? [];
    });

    let totalUpserts = 0;
    let totalIssuesSeen = 0;
    const perInstallReport: Array<{
      install: number;
      account: string;
      repos: number;
      targets: number;
      sampleTargets: string[];
      issues: number;
      upserts: number;
      errors: string[];
    }> = [];

    for (const install of installs) {
      const setup = await step.run(`setup-install-${install.id}`, async () => {
        const sb = getServiceSupabase();
        if (!sb) throw new Error('service role missing');

        const { data: repoRows } = await sb
          .from('installation_repositories')
          .select('repo_full_name')
          .eq('installation_id', install.id)
          // Least-recently-swept first so repos past the per-install cap still
          // get swept on later runs instead of an alphabetical top-20 forever.
          .order('last_swept_at', { ascending: true, nullsFirst: true })
          .order('repo_full_name', { ascending: true })
          .limit(MAX_REPOS_PER_INSTALL);

        let repos = (repoRows ?? []) as RepoRow[];

        // Self-healing: if installation_repositories is empty for an active install,
        // re-discover accessible repos via GitHub API and populate table.
        if (repos.length === 0) {
          try {
            const octokit = await getInstallOctokit(install.id);
            const res = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
              per_page: 100,
            });
            const discovered = (res as unknown as Array<{ full_name: string }>).map(
              (r) => r.full_name,
            );
            if (discovered.length > 0) {
              await sb.from('installation_repositories').upsert(
                discovered.map((fullName) => ({
                  installation_id: install.id,
                  repo_full_name: fullName,
                })),
                { onConflict: 'installation_id,repo_full_name' },
              );
              repos = discovered
                .map((fullName) => ({ repo_full_name: fullName }))
                .slice(0, MAX_REPOS_PER_INSTALL);

              await inngest.send({
                name: 'pr-backfill/installation',
                data: { installationId: install.id },
              });
            }
          } catch (e) {
            return { repos: [], error: `repo-discovery: ${(e as Error).message}` };
          }
        }

        return { repos, error: null as string | null };
      });

      if (setup.error) {
        perInstallReport.push({
          install: install.id,
          account: install.account_login,
          repos: 0,
          targets: 0,
          sampleTargets: [],
          issues: 0,
          upserts: 0,
          errors: [setup.error],
        });
        continue;
      }

      // Best-effort dedup of resolved upstream targets within this install.
      // Cheap: repos.get is still called per repo, but the LLM + issues work
      // is skipped for a fork whose upstream was already swept this run.
      const seenTargets = new Set<string>();
      const reports: RepoReport[] = [];
      let issuesThisInstall = 0;
      let reposProcessed = 0;

      for (const repo of setup.repos) {
        if (
          totalIssuesSeen >= MAX_ISSUES_PER_SWEEP ||
          issuesThisInstall >= MAX_ISSUES_PER_INSTALL
        ) {
          break;
        }

        // Budget re-checked before every repo so a rate-limited install stops
        // making GitHub calls mid-loop instead of hammering the API.
        const budget = await step.run(
          `check-budget-${install.id}-${repo.repo_full_name.replace('/', '-')}`,
          () => checkRateBudget(install.id),
        );
        if (!budget.ok) {
          await step.sleepUntil(
            `sleep-budget-${install.id}-${repo.repo_full_name.replace('/', '-')}`,
            new Date(budget.resetAt * 1000 + 5000),
          );
        }

        const report = await step.run(
          `sweep-${install.id}-${repo.repo_full_name.replace('/', '-')}`,
          async () =>
            sweepRepo(
              install.id,
              repo.repo_full_name,
              Math.min(
                MAX_ISSUES_PER_SWEEP - totalIssuesSeen,
                MAX_ISSUES_PER_INSTALL - issuesThisInstall,
              ),
              seenTargets,
            ),
        );
        reports.push(report);
        reposProcessed += 1;
        issuesThisInstall += report.issues;
        totalIssuesSeen += report.issues;
      }

      // Rotate the install to the back of the queue so it isn't re-picked until
      // the other installs have had a turn. Only if at least one repo was
      // actually processed — a fully budget-blocked install stays eligible so
      // its repos get reached on the next sweep.
      if (reposProcessed > 0) {
        await step.run(`mark-install-swept-${install.id}`, async () => {
          const sb = getServiceSupabase();
          if (!sb) return;
          await sb
            .from('github_installations')
            .update({ last_swept_at: new Date().toISOString() })
            .eq('id', install.id);
        });
      }

      perInstallReport.push({
        install: install.id,
        account: install.account_login,
        repos: setup.repos.length,
        targets: reports.reduce((acc, r) => acc + r.targets, 0),
        sampleTargets: reports.flatMap((r) => r.sampleTargets).slice(0, 10),
        issues: issuesThisInstall,
        upserts: reports.reduce((acc, r) => acc + r.upserts, 0),
        errors: reports.flatMap((r) => r.errors).slice(0, 10),
      });

      totalUpserts += reports.reduce((acc, r) => acc + r.upserts, 0);
    }

    await step.run('build-recommendations', async () => {
      await inngest.send({ name: 'recommendations/build', data: {} });
    });

    return {
      installs: installs.length,
      totalUpserts,
      perInstall: perInstallReport,
    };
  },
);

async function markRepoSwept(installationId: number, repoFullName: string): Promise<void> {
  const sb = getServiceSupabase();
  if (!sb) return;
  await sb
    .from('installation_repositories')
    .update({ last_swept_at: new Date().toISOString() })
    .eq('installation_id', installationId)
    .eq('repo_full_name', repoFullName);
}

async function sweepRepo(
  installationId: number,
  repoFullName: string,
  issueBudget: number,
  seenTargets: Set<string>,
): Promise<RepoReport> {
  const errors: string[] = [];
  const sb = getServiceSupabase();
  if (!sb) {
    return {
      repo: repoFullName,
      target: repoFullName,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors: ['service role missing'],
    };
  }

  let octokit;
  try {
    octokit = await getInstallOctokit(installationId);
  } catch (e) {
    return {
      repo: repoFullName,
      target: repoFullName,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors: [`install-token: ${(e as Error).message}`],
    };
  }

  const [owner, name] = repoFullName.split('/');
  if (!owner || !name) {
    return {
      repo: repoFullName,
      target: repoFullName,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors: ['bad repo name'],
    };
  }

  // Resolve fork → upstream. The interesting issues live on the upstream a
  // user forked from, not on the fork itself.
  let target = repoFullName;
  const via = repoFullName;
  let isFork = false;
  try {
    const meta = await octokit.repos.get({ owner, repo: name });
    isFork = Boolean(meta.data.fork);
    target = isFork ? (meta.data.parent?.full_name ?? repoFullName) : repoFullName;
  } catch (e) {
    errors.push(`repos.get ${repoFullName}: ${(e as Error).message}`);
    return {
      repo: repoFullName,
      target: repoFullName,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors,
    };
  }

  if (seenTargets.has(target)) {
    // Handled (cheap repos.get only) — rotate it so it isn't re-picked every
    // run while the upstream is already being swept elsewhere in the install.
    await markRepoSwept(installationId, repoFullName);
    return {
      repo: repoFullName,
      target,
      skipped: true,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors,
    };
  }
  seenTargets.add(target);

  const [tOwner, tName] = target.split('/');
  if (!tOwner || !tName) {
    return {
      repo: repoFullName,
      target,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors,
    };
  }

  // Real repo health signals + primary language (cached 24h) instead of the
  // prior hardcoded constants.
  const metrics = await fetchRepoMetrics(octokit, tOwner, tName);
  const healthScore = repoHealth(metrics);
  const repoLanguage = metrics.language;

  // Per-repo cursor: resume from the last page we processed so a large repo
  // is walked incrementally across sweeps instead of always re-sweeping page 1.
  const lastPage = await getSyncCursor(installationId, target, SYNC_TYPE);
  const startingPage = (lastPage ?? 0) + 1;

  let issues: Array<{
    number: number;
    title: string;
    body: string | null;
    html_url: string;
    comments: number;
    labels: Array<string | { name?: string }>;
    pull_request?: unknown;
  }> = [];
  try {
    const res = await octokit.issues.listForRepo({
      owner: tOwner,
      repo: tName,
      state: 'open',
      per_page: ISSUES_PER_REPO_PAGE,
      page: startingPage,
      sort: 'updated',
    });
    issues = res.data as typeof issues;
  } catch (e) {
    errors.push(`issues.list ${target}: ${(e as Error).message}`);
    return {
      repo: repoFullName,
      target,
      skipped: false,
      targets: 0,
      sampleTargets: [],
      issues: 0,
      upserts: 0,
      errors,
    };
  }

  // Pre-fetch existing issues for this repository to reuse cached difficulty
  // and respect the 24h re-score cooldown (keeps LLM spend bounded).
  const issueNumbers = issues.filter((i) => !i.pull_request).map((i) => i.number);
  const existingIssuesMap = new Map<
    number,
    {
      difficulty: string | null;
      difficulty_source: string | null;
      xp_reward: number;
      scored_at: string | null;
    }
  >();
  if (issueNumbers.length > 0) {
    const { data: existingIssues } = await sb
      .from('issues')
      .select('github_issue_number, difficulty, difficulty_source, xp_reward, scored_at')
      .eq('repo_full_name', target)
      .in('github_issue_number', issueNumbers);

    if (existingIssues) {
      for (const ex of existingIssues) {
        existingIssuesMap.set(ex.github_issue_number, ex);
      }
    }
  }

  const now = Date.now();
  let issuesSeen = 0;
  let upserts = 0;
  let budgetTruncated = false;

  for (const issue of issues) {
    if (issue.pull_request) continue;
    if (issuesSeen >= issueBudget) {
      // Hit the per-repo budget mid-page. A full page can still hold
      // unprocessed issues past the budget, so flag it and keep the cursor.
      budgetTruncated = true;
      break;
    }
    issuesSeen += 1;

    const labels = (issue.labels ?? []).map((l) => (typeof l === 'string' ? l : (l.name ?? '')));

    let scored;
    const existing = existingIssuesMap.get(issue.number);
    if (existing?.difficulty && existing?.difficulty_source) {
      // Cached forever — no LLM call.
      scored = {
        difficulty: existing.difficulty as 'E' | 'M' | 'H',
        source: existing.difficulty_source as 'label' | 'heuristic' | 'llm' | 'maintainer',
        xpReward: existing.xp_reward,
      };
    } else if (
      existing?.scored_at &&
      now - new Date(existing.scored_at).getTime() < SCORE_COOLDOWN_MS
    ) {
      // Attempted within the last 24h — skip re-scoring so LLM spend stays
      // bounded. Revisited on a later sweep if it still has no difficulty.
      continue;
    } else {
      scored = await scoreDifficulty(
        {
          title: issue.title,
          body: issue.body ?? undefined,
          labels,
          commentCount: issue.comments,
        },
        {
          llmFallback: async (i) =>
            llmCall({
              prompt: `Rate this OSS issue's difficulty as E/M/H.\nTitle: ${i.title}\nLabels: ${i.labels.join(', ')}\nBody: ${(i.body ?? '').slice(0, 800)}\n\nReturn JSON: {"difficulty":"E"|"M"|"H","confidence":0..1,"reason":"..."}`,
              schema: DifficultySchema,
            }),
        },
      );
    }

    const { error } = await sb.from('issues').upsert(
      {
        repo_full_name: target,
        github_issue_number: issue.number,
        title: issue.title,
        body_excerpt: (issue.body ?? '').slice(0, 500),
        difficulty: scored.difficulty,
        difficulty_source: scored.source,
        xp_reward: scored.xpReward,
        labels: labels.filter((l): l is string => Boolean(l)),
        state: 'open',
        url: issue.html_url,
        repo_health_score: healthScore,
        repo_language: repoLanguage,
        scored_at: new Date().toISOString(),
      },
      { onConflict: 'repo_full_name,github_issue_number' },
    );
    if (error) {
      errors.push(`upsert ${target}#${issue.number}: ${error.code ?? ''} ${error.message}`);
    } else {
      upserts += 1;
    }
  }

  // Advance the cursor; clear it once we've caught up so the next sweep
  // starts from page 1 again. Only when the page was fully drained: if the
  // loop was budget-truncated, a full page still has unprocessed issues on
  // it, so leave the cursor in place and retry the same page next sweep
  // instead of skipping whatever was left over.
  if (!budgetTruncated) {
    if (issues.length < ISSUES_PER_REPO_PAGE) {
      await clearSyncCursor(installationId, target, SYNC_TYPE);
    } else {
      await setSyncCursor(installationId, target, SYNC_TYPE, startingPage);
    }
  }

  // Rotate the repo to the back of the per-install queue so repos past the
  // cap still get swept on later runs.
  await markRepoSwept(installationId, repoFullName);

  return {
    repo: repoFullName,
    target,
    skipped: false,
    targets: 1,
    sampleTargets: [`${target} (via ${via}${isFork ? ', fork' : ''})`],
    issues: issuesSeen,
    upserts,
    errors: errors.slice(0, 10),
  };
}
