export type * from './types';
export type { StalePrRow, AiDetectionBreakdown } from './analytics';
export type { ContributorListRow, ContributorStats } from './contributors';
export type { FailedWebhookEventRow } from './failed-events';
export type { XpPreviewBreakdown } from './xp-preview';
export type { InviteRow } from './invites';

import * as settingsActions from './settings';
import * as queueActions from './queue';
import * as communityActions from './community';
import * as analyticsActions from './analytics';
import * as flaggedAccountsActions from './flagged-accounts';
import * as contributorsActions from './contributors';

export { sendInvite, getMyGithubHandle, listPendingInvites, resendInvite } from './invites';
export {
  removeContributorFromOrg,
  getContributorStats,
  exportContributorsCsv,
} from './contributors';
export { getFailedWebhookEvents, retryFailedWebhookEvent } from './failed-events';
export { previewMergeXp } from './xp-preview';
export { pingReviewers } from './ping-reviewers';

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

export async function closePullRequest(
  ...args: Parameters<typeof queueActions.closePullRequest>
): ReturnType<typeof queueActions.closePullRequest> {
  return queueActions.closePullRequest(...args);
}

export async function getPrDiff(
  ...args: Parameters<typeof queueActions.getPrDiff>
): ReturnType<typeof queueActions.getPrDiff> {
  return queueActions.getPrDiff(...args);
}

export async function getPrActivityTimeline(
  ...args: Parameters<typeof queueActions.getPrActivityTimeline>
): ReturnType<typeof queueActions.getPrActivityTimeline> {
  return queueActions.getPrActivityTimeline(...args);
}

export async function getPrDetails(
  ...args: Parameters<typeof queueActions.getPrDetails>
): ReturnType<typeof queueActions.getPrDetails> {
  return queueActions.getPrDetails(...args);
}

export async function getMaintainerPrById(
  ...args: Parameters<typeof queueActions.getMaintainerPrById>
): ReturnType<typeof queueActions.getMaintainerPrById> {
  return queueActions.getMaintainerPrById(...args);
}

export async function requestChanges(
  ...args: Parameters<typeof queueActions.requestChanges>
): ReturnType<typeof queueActions.requestChanges> {
  return queueActions.requestChanges(...args);
}

export async function postPrComment(
  ...args: Parameters<typeof queueActions.postPrComment>
): ReturnType<typeof queueActions.postPrComment> {
  return queueActions.postPrComment(...args);
}

export async function mergePullRequest(
  ...args: Parameters<typeof queueActions.mergePullRequest>
): ReturnType<typeof queueActions.mergePullRequest> {
  return queueActions.mergePullRequest(...args);
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

export async function getNoiseBreakdown(
  ...args: Parameters<typeof analyticsActions.getNoiseBreakdown>
): ReturnType<typeof analyticsActions.getNoiseBreakdown> {
  return analyticsActions.getNoiseBreakdown(...args);
}

export async function getPromotionEligible(
  ...args: Parameters<typeof analyticsActions.getPromotionEligible>
): ReturnType<typeof analyticsActions.getPromotionEligible> {
  return analyticsActions.getPromotionEligible(...args);
}

export async function getAiDetectionBreakdown(
  ...args: Parameters<typeof analyticsActions.getAiDetectionBreakdown>
): ReturnType<typeof analyticsActions.getAiDetectionBreakdown> {
  return analyticsActions.getAiDetectionBreakdown(...args);
}

export async function getTimeSaved(
  ...args: Parameters<typeof analyticsActions.getTimeSaved>
): ReturnType<typeof analyticsActions.getTimeSaved> {
  return analyticsActions.getTimeSaved(...args);
}

export async function getRepoAnalyticsBreakdown(
  ...args: Parameters<typeof analyticsActions.getRepoAnalyticsBreakdown>
): ReturnType<typeof analyticsActions.getRepoAnalyticsBreakdown> {
  return analyticsActions.getRepoAnalyticsBreakdown(...args);
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

export async function getContributorsList(
  ...args: Parameters<typeof contributorsActions.getContributorsList>
): ReturnType<typeof contributorsActions.getContributorsList> {
  return contributorsActions.getContributorsList(...args);
}
