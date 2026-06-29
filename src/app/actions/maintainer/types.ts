import type { IssueTriageBucket } from '@/lib/maintainer/issue-triage';
import type { MaintainerAnalyticsTrends } from '@/lib/maintainer/analytics';
import type { CommunityKind } from '@/lib/maintainer/community';
import type { MaintainerPrRow } from '@/lib/maintainer/queue';

export type { MaintainerPrRow };

export type MaintainerIssueRow = {
  id: number;
  repoFullName: string;
  number: number;
  title: string;
  url: string;
  state: 'open' | 'closed';
  authorLogin: string | null;
  assigneeLogin: string | null;
  labels: string[];
  commentsCount: number;
  lastEventAt: string | null;
  githubCreatedAt: string | null;
  triage: IssueTriageBucket;
};

export type RepoHealthRow = {
  repoFullName: string;
  repoHealthScore: number;
  updatedAt: string | null;
};

export type StaleIssueRow = {
  id: number;
  title: string;
  repoFullName: string;
  daysStale: number;
  claimed: boolean;
};

export type ContributorRow = {
  githubHandle: string;
  xp: number;
  level: number;
};

export type FlaggedAccountRow = {
  id: number;
  githubHandle: string;
  xp: number;
  level: number;
  reason: string;
  severity: 'medium' | 'high';
  detectedAt: string;
  summary: string;
  count: number;
};

export type InstallationSettingsData = {
  installationId: number;
  minContributorLevel: 0 | 1 | 2 | 3;
  autoAssignMentorChain: boolean;
  aiPrDetection: boolean;
};

export type CommunityLink = {
  id: number;
  installationId: number;
  kind: CommunityKind;
  url: string;
  label: string | null;
  updatedAt: string;
};

export type RepoPickerRow = {
  repoFullName: string;
  managed: boolean;
  language: string | null;
  openPrCount: number;
  lastUpdatedAt: string | null;
};

export type ReviewerLoadRow = {
  reviewerId: string;
  githubHandle: string;
  avatarUrl: string | null;
  prCount: number;
};
