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
 * Cron: every 30 min.
 */
export const issuesSweep = inngest.createFunction(
  { id: 'issues-sweep' },
  { cron: '*/30 * * * *' },
  async ({ step }) => {
    const sweepCount = await step.run('sweep-all-installs', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const { data: installs } = await sb
        .from('github_installations')
        .select('id, account_login')
        .is('uninstalled_at', null)
        .is('suspended_at', null);

      let total = 0;
      for (const install of installs ?? []) {
        const { data: repos } = await sb
          .from('installation_repositories')
          .select('repo_full_name')
          .eq('installation_id', install.id);

        const octokit = await getInstallOctokit(install.id);

        for (const repo of repos ?? []) {
          const [owner, name] = repo.repo_full_name.split('/');
          if (!owner || !name) continue;

          const { data: issues } = await octokit.issues.listForRepo({
            owner,
            repo: name,
            state: 'open',
            per_page: 30,
            sort: 'updated',
          });

          for (const issue of issues) {
            if (issue.pull_request) continue; // skip PRs

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

            await sb.from('issues').upsert(
              {
                repo_full_name: repo.repo_full_name,
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
                  stars: 100, // refined by a future repo-meta sweep
                  recentCommits30d: 5,
                  hasContributingMd: true,
                  hasLicense: true,
                }),
                scored_at: new Date().toISOString(),
              },
              { onConflict: 'repo_full_name,github_issue_number' },
            );

            total += 1;
          }
        }
      }
      return total;
    });

    return { swept: sweepCount };
  },
);
