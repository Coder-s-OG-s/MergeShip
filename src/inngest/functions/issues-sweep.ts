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

        // Resolve fork → upstream. The interesting issues live on the
        // upstream a user forked from, not on the fork itself. Dedup the
        // resulting set so two users forking the same project don't
        // sweep it twice.
        const targets = new Set<string>();
        for (const repo of repos ?? []) {
          const [owner, name] = repo.repo_full_name.split('/');
          if (!owner || !name) continue;
          try {
            const meta = await octokit.repos.get({ owner, repo: name });
            const upstream = meta.data.fork
              ? (meta.data.parent?.full_name ?? null)
              : repo.repo_full_name;
            if (upstream) targets.add(upstream);
          } catch {
            // Repo went private, deleted, or the install lost access —
            // skip silently.
          }
        }

        for (const target of targets) {
          const [owner, name] = target.split('/');
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
          } catch {
            // Public-issue read should work even without install access;
            // if it fails the upstream isn't reachable, skip.
            continue;
          }

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

    // Build per-user recommendations off the freshly-scored issue pool.
    await step.run('build-recommendations', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');
      await inngest.send({ name: 'recommendations/build', data: {} });
    });

    return { swept: sweepCount };
  },
);
