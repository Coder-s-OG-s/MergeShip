'use server';
import { requireMaintainerAuth } from '@/lib/action-auth';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';
import { ok, err, type Result } from '@/lib/result';
import * as settingsActions from './settings';
import * as queueActions from './queue';
import * as communityActions from './community';
import * as analyticsActions from './analytics';
import * as flaggedAccountsActions from './flagged-accounts';

export type * from './types';
export type { StalePrRow } from './analytics';

export async function getMaintainerInstalls(
  ...args: Parameters<typeof settingsActions.getMaintainerInstalls>
): ReturnType<typeof settingsActions.getMaintainerInstalls> {
  return settingsActions.getMaintainerInstalls(...args);
}

export async function getInstallationSettings(
  ...args: Parameters<typeof settingsActions.getInstallationSettings>
): ReturnType<typeof settingsActions.getInstallationSettings> {
  return settingsActions.getInstallationSettings(...args);
}

export async function setMinContributorLevel(
  ...args: Parameters<typeof settingsActions.setMinContributorLevel>
): ReturnType<typeof settingsActions.setMinContributorLevel> {
  return settingsActions.setMinContributorLevel(...args);
}

export async function setAutoAssignMentorChain(
  ...args: Parameters<typeof settingsActions.setAutoAssignMentorChain>
): ReturnType<typeof settingsActions.setAutoAssignMentorChain> {
  return settingsActions.setAutoAssignMentorChain(...args);
}

export async function setAiPrDetection(
  ...args: Parameters<typeof settingsActions.setAiPrDetection>
): ReturnType<typeof settingsActions.setAiPrDetection> {
  return settingsActions.setAiPrDetection(...args);
}

export async function getRepoPicker(
  ...args: Parameters<typeof settingsActions.getRepoPicker>
): ReturnType<typeof settingsActions.getRepoPicker> {
  return settingsActions.getRepoPicker(...args);
}

export async function setRepoManaged(
  ...args: Parameters<typeof settingsActions.setRepoManaged>
): ReturnType<typeof settingsActions.setRepoManaged> {
  return settingsActions.setRepoManaged(...args);
}

export async function getMaintainerPrQueue(
  ...args: Parameters<typeof queueActions.getMaintainerPrQueue>
): ReturnType<typeof queueActions.getMaintainerPrQueue> {
  return queueActions.getMaintainerPrQueue(...args);
}

export async function getMaintainerIssueQueue(
  ...args: Parameters<typeof queueActions.getMaintainerIssueQueue>
): ReturnType<typeof queueActions.getMaintainerIssueQueue> {
  return queueActions.getMaintainerIssueQueue(...args);
}

export async function refreshMaintainerBackfill(
  ...args: Parameters<typeof queueActions.refreshMaintainerBackfill>
): ReturnType<typeof queueActions.refreshMaintainerBackfill> {
  return queueActions.refreshMaintainerBackfill(...args);
}

export async function getPrCiStatus(
  ...args: Parameters<typeof queueActions.getPrCiStatus>
): ReturnType<typeof queueActions.getPrCiStatus> {
  return queueActions.getPrCiStatus(...args);
}

export async function getCommunityLinks(
  ...args: Parameters<typeof communityActions.getCommunityLinks>
): ReturnType<typeof communityActions.getCommunityLinks> {
  return communityActions.getCommunityLinks(...args);
}

export async function upsertCommunityLink(
  ...args: Parameters<typeof communityActions.upsertCommunityLink>
): ReturnType<typeof communityActions.upsertCommunityLink> {
  return communityActions.upsertCommunityLink(...args);
}

export async function deleteCommunityLink(
  ...args: Parameters<typeof communityActions.deleteCommunityLink>
): ReturnType<typeof communityActions.deleteCommunityLink> {
  return communityActions.deleteCommunityLink(...args);
}

export async function getRepoHealthOverview(
  ...args: Parameters<typeof analyticsActions.getRepoHealthOverview>
): ReturnType<typeof analyticsActions.getRepoHealthOverview> {
  return analyticsActions.getRepoHealthOverview(...args);
}

export async function getStaleIssues(
  ...args: Parameters<typeof analyticsActions.getStaleIssues>
): ReturnType<typeof analyticsActions.getStaleIssues> {
  return analyticsActions.getStaleIssues(...args);
}

export async function getStalePrs(
  ...args: Parameters<typeof analyticsActions.getStalePrs>
): ReturnType<typeof analyticsActions.getStalePrs> {
  return analyticsActions.getStalePrs(...args);
}

export async function getTopContributors(
  ...args: Parameters<typeof analyticsActions.getTopContributors>
): ReturnType<typeof analyticsActions.getTopContributors> {
  return analyticsActions.getTopContributors(...args);
}

export async function getMaintainerAnalyticsTrends(
  ...args: Parameters<typeof analyticsActions.getMaintainerAnalyticsTrends>
): ReturnType<typeof analyticsActions.getMaintainerAnalyticsTrends> {
  return analyticsActions.getMaintainerAnalyticsTrends(...args);
}

export async function exportPrQueueCsv(
  ...args: Parameters<typeof analyticsActions.exportPrQueueCsv>
): ReturnType<typeof analyticsActions.exportPrQueueCsv> {
  return analyticsActions.exportPrQueueCsv(...args);
}

export async function getReviewerLoad(
  ...args: Parameters<typeof analyticsActions.getReviewerLoad>
): ReturnType<typeof analyticsActions.getReviewerLoad> {
  return analyticsActions.getReviewerLoad(...args);
}

export async function getFlaggedAccounts(
  ...args: Parameters<typeof flaggedAccountsActions.getFlaggedAccounts>
): ReturnType<typeof flaggedAccountsActions.getFlaggedAccounts> {
  return flaggedAccountsActions.getFlaggedAccounts(...args);
}

export async function resolveFlaggedAccount(
  ...args: Parameters<typeof flaggedAccountsActions.resolveFlaggedAccount>
): ReturnType<typeof flaggedAccountsActions.resolveFlaggedAccount> {
  return flaggedAccountsActions.resolveFlaggedAccount(...args);
}

export async function pingReviewers(prId: number): Promise<Result<{ commented: boolean }>> {
  const auth = await requireMaintainerAuth();
  if (!auth.ok) return auth;

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'Service role not configured');

  // Fetch the PR row to get installation and metadata
  const { data: pr, error: prErr } = await service
    .from('pull_requests')
    .select('number, repo_full_name, installation_id, url')
    .eq('id', prId)
    .maybeSingle();

  if (prErr || !pr) return err('not_found', 'PR not found');

  const [owner, repo] = pr.repo_full_name.split('/');
  if (!owner || !repo) return err('invalid_data', 'Could not parse repo name');

  try {
    const octokit = await getInstallOctokit(pr.installation_id);
    await octokit.rest.issues.createComment({
      owner,
      repo,
      issue_number: pr.number,
      body: '👋 **Ping from MergeShip**: This PR has been waiting for reviewer feedback for over 14 days. Could reviewers please take a look when they get a chance?',
    });
    return ok({ commented: true });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'GitHub API error';
    return err('github_error', msg);
  }
}

export {
  closePullRequest,
  getPrDiff,
  getPrActivityTimeline,
  getPrDetails,
  getMaintainerPrById,
  requestChanges,
  mergePullRequest,
} from './queue';

export {
  getContributorsList,
  removeContributorFromOrg,
  type ContributorListRow,
  getContributorStats,
  type ContributorStats,
} from './contributors';

export { getNoiseBreakdown, getPromotionEligible } from './analytics';

export {
  getFailedWebhookEvents,
  retryFailedWebhookEvent,
  type FailedWebhookEventRow,
} from './failed-events';
export { previewMergeXp, type XpPreviewBreakdown } from './xp-preview';
