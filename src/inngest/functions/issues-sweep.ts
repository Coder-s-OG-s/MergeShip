import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { scoreDifficulty, repoHealth } from '@/lib/pipeline/score';
import { llmCall } from '@/lib/llm/router';
import { DifficultySchema } from '@/lib/llm/schemas';

/**
 * Pulls open issues from every active GitHub App install, scores difficulty,
 * upserts into the issues table.
 *
 * Cron: every 30 min. The function is split into named steps so the run
 * trace shows where rows drop. Each step returns counts + a sample so a
 * single Inngest run trace tells us exactly what's happening.
 */

type RepoRow = { repo_full_name: string };
type ResolvedTarget = { target: string; via: string; isFork: boolean };

export const issuesSweep = inngest.createFunction(
  { id: 'issues-sweep' },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const installs = await step.run('list-installs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      const { data } = await sb
        .from('github_installations')
        .select('id, account_login')
        .is('uninstalled_at', null)
        .is('suspended_at', null);
      return data ?? [];
    });

    let totalUpserts = 0;
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
      // Each install is its own checkpoint so we can see the boundary in
      // the trace if one install blows up.
      const report = await step.run(`process-install-${install.id}`, async () => {
        const sb = getServiceSupabase();
        if (!sb) throw new Error('service role missing');

        const errors: string[] = [];

        const { data: repoRows } = await sb
          .from('installation_repositories')
          .select('repo_full_name')
          .eq('installation_id', install.id);

        const repos = (repoRows ?? []) as RepoRow[];

        let octokit;
        try {
          octokit = await getInstallOctokit(install.id);
        } catch (e) {
          return {
            install: install.id,
            account: install.account_login,
            repos: repos.length,
            targets: 0,
            sampleTargets: [],
            issues: 0,
            upserts: 0,
            errors: [`install-token: ${(e as Error).message}`],
          };
        }

        // Resolve fork → upstream. The interesting issues live on the
        // upstream a user forked from, not on the fork itself. Dedup
        // so two users forking the same project don't sweep it twice.
        const resolved: ResolvedTarget[] = [];
        const targetSet = new Set<string>();
        for (const repo of repos) {
          const [owner, name] = repo.repo_full_name.split('/');
          if (!owner || !name) continue;
          try {
            const meta = await octokit.repos.get({ owner, repo: name });
            const isFork = Boolean(meta.data.fork);
            const upstream = isFork ? (meta.data.parent?.full_name ?? null) : repo.repo_full_name;
            if (upstream && !targetSet.has(upstream)) {
              targetSet.add(upstream);
              resolved.push({ target: upstream, via: repo.repo_full_name, isFork });
            }
          } catch (e) {
            errors.push(`repos.get ${repo.repo_full_name}: ${(e as Error).message}`);
          }
        }

        let issuesSeen = 0;
        let upserts = 0;

        for (const t of resolved) {
          const [owner, name] = t.target.split('/');
          if (!owner || !name) continue;

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
              owner,
              repo: name,
              state: 'open',
              per_page: 30,
              sort: 'updated',
            });
            issues = res.data as typeof issues;
          } catch (e) {
            errors.push(`issues.list ${t.target}: ${(e as Error).message}`);
            continue;
          }

          for (const issue of issues) {
            if (issue.pull_request) continue;
            issuesSeen += 1;

            const labels = (issue.labels ?? []).map((l) =>
              typeof l === 'string' ? l : (l.name ?? ''),
            );

            const scored = await scoreDifficulty(
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

            const { error } = await sb.from('issues').upsert(
              {
                repo_full_name: t.target,
                github_issue_number: issue.number,
                title: issue.title,
                body_excerpt: (issue.body ?? '').slice(0, 500),
                difficulty: scored.difficulty,
                difficulty_source: scored.source,
                xp_reward: scored.xpReward,
                labels: labels.filter((l): l is string => Boolean(l)),
                state: 'open',
                url: issue.html_url,
                repo_health_score: repoHealth({
                  stars: 100,
                  recentCommits30d: 5,
                  hasContributingMd: true,
                  hasLicense: true,
                }),
                scored_at: new Date().toISOString(),
              },
              { onConflict: 'repo_full_name,github_issue_number' },
            );
            if (error) {
              errors.push(
                `upsert ${t.target}#${issue.number}: ${error.code ?? ''} ${error.message}`,
              );
            } else {
              upserts += 1;
            }
          }
        }

        return {
          install: install.id,
          account: install.account_login,
          repos: repos.length,
          targets: resolved.length,
          sampleTargets: resolved
            .slice(0, 10)
            .map((r) => `${r.target} (via ${r.via}${r.isFork ? ', fork' : ''})`),
          issues: issuesSeen,
          upserts,
          errors: errors.slice(0, 10),
        };
      });

      perInstallReport.push(report);
      totalUpserts += report.upserts;
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
