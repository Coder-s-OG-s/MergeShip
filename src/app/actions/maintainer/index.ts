export type * from './types';

export {
  getMaintainerInstalls,
  getInstallationSettings,
  setMinContributorLevel,
  setAutoAssignMentorChain,
  setAiPrDetection,
  getRepoPicker,
  setRepoManaged,
} from './settings';

export {
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  refreshMaintainerBackfill,
  getPrCiStatus,
  closePullRequest,
  getPrDiff,
  getPrActivityTimeline,
  getPrDetails,
  getMaintainerPrById,
  requestChanges,
  mergePullRequest,
} from './queue';

export { getCommunityLinks, upsertCommunityLink, deleteCommunityLink } from './community';
export {
  getContributorsList,
  exportContributorsCsv,
  removeContributorFromOrg,
  type ContributorListRow,
  getContributorStats,
  type ContributorStats,
} from './contributors';
export {
  getRepoHealthOverview,
  getStaleIssues,
  getStalePrs,
  type StalePrRow,
  getTopContributors,
  getMaintainerAnalyticsTrends,
  exportPrQueueCsv,
  getReviewerLoad,
  getNoiseBreakdown,
  getPromotionEligible,
} from './analytics';

export { getFlaggedAccounts, resolveFlaggedAccount } from './flagged-accounts';
export {
  listPendingInvites,
  sendInvite,
  resendInvite,
  getMyGithubHandle,
  type InviteRow,
} from './invites';

export {
  getFailedWebhookEvents,
  retryFailedWebhookEvent,
  type FailedWebhookEventRow,
} from './failed-events';
export { previewMergeXp, type XpPreviewBreakdown } from './xp-preview';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { getDb } from '@/lib/db/client';
import { pullRequests, installationRepositories } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { getInstallOctokit } from '@/lib/github/app';

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

  const octokit = await getInstallOctokit(repoRow.installationId);

  await octokit.issues.createComment({
    owner,
    repo,
    issue_number: pr.number,
    body: 'Gentle reminder: this pull request is awaiting review. Could the reviewers please take a look?',
  });

  return ok({ commented: true });
}
