'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { getDb } from '@/lib/db/client';
import { pullRequests, installationRepositories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getInstallOctokit } from '@/lib/github/app';
import { listMaintainerRepos } from '@/lib/maintainer/detect';

export async function pingReviewers(prId: number): Promise<Result<{ commented: boolean }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:ping-reviewers', ...RATE_LIMIT_TIERS.STANDARD },
  });
  if (!authRes.ok) return authRes;

  const db = getDb();
  const [pr] = await db.select().from(pullRequests).where(eq(pullRequests.id, prId));

  if (!pr) return err('not_found', 'PR not found');

  const [owner, repo] = pr.repoFullName.split('/');
  if (!owner || !repo) return err('invalid_data', 'Could not parse repo name');

  const [repoRow] = await db
    .select({ installationId: installationRepositories.installationId })
    .from(installationRepositories)
    .where(eq(installationRepositories.repoFullName, pr.repoFullName));

  if (!repoRow) {
    return err('not_found', 'Installation not found for this repository');
  }

  const repos = await listMaintainerRepos(authRes.data.user.id, repoRow.installationId);
  if (!repos.includes(pr.repoFullName)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  const octokit = await getInstallOctokit(repoRow.installationId);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body: 'Gentle reminder: this pull request is awaiting review. Could the reviewers please take a look?',
  });

  return ok({ commented: true });
}
