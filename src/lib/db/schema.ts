/**
 * MergeShip database schema (Drizzle).
 *
 * Conventions:
 *  - snake_case column names (Postgres native)
 *  - timestamps in UTC, default now()
 *  - all user-data tables enable RLS via SQL migration
 *  - xp_events is append-only; profiles.xp and profiles.level are derived caches
 *  - UNIQUE constraints enforce idempotency on every event source
 */

import {
  pgTable,
  bigserial,
  text,
  integer,
  boolean,
  timestamp,
  jsonb,
  date,
  uuid,
  uniqueIndex,
  index,
  primaryKey,
  bigint,
} from 'drizzle-orm/pg-core';

// ---------- users / identity ----------

export const profiles = pgTable(
  'profiles',
  {
    id: uuid('id').primaryKey(),
    githubId: text('github_id').notNull().unique(),
    githubHandle: text('github_handle').notNull().unique(),
    displayName: text('display_name'),
    avatarUrl: text('avatar_url'),
    role: text('role', { enum: ['contributor', 'maintainer', 'both'] })
      .notNull()
      .default('contributor'),
    primaryLanguage: text('primary_language'),
    xp: integer('xp').notNull().default(0),
    level: integer('level').notNull().default(0),
    auditCompleted: boolean('audit_completed').notNull().default(false),
    timezone: text('timezone'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
    bio: text('bio'),
    skills: text('skills').array(),
    websiteUrl: text('website_url'),
    twitterHandle: text('twitter_handle'),
  },
  (t) => ({
    xpDescIdx: index('profiles_xp_desc_idx').on(t.xp),
    primaryLangXpIdx: index('profiles_primary_lang_xp_idx').on(t.primaryLanguage, t.xp),
  }),
);

// ---------- GitHub App installations (the gate) ----------

export const githubInstallations = pgTable(
  'github_installations',
  {
    id: bigint('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    accountLogin: text('account_login').notNull(),
    accountType: text('account_type', { enum: ['User', 'Organization'] }).notNull(),
    repositorySelection: text('repository_selection', { enum: ['all', 'selected'] }).notNull(),
    installedAt: timestamp('installed_at', { withTimezone: true }).notNull().defaultNow(),
    suspendedAt: timestamp('suspended_at', { withTimezone: true }),
    uninstalledAt: timestamp('uninstalled_at', { withTimezone: true }),
  },
  (t) => ({
    userIdx: index('github_installations_user_idx').on(t.userId),
    accountIdx: index('github_installations_account_idx').on(t.accountLogin),
  }),
);

export const installationRepositories = pgTable(
  'installation_repositories',
  {
    installationId: bigint('installation_id', { mode: 'number' })
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    repoFullName: text('repo_full_name').notNull(),
    addedAt: timestamp('added_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.installationId, t.repoFullName] }),
  }),
);

// ---------- issues (computed cache, forever) ----------

export const issues = pgTable(
  'issues',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    repoFullName: text('repo_full_name').notNull(),
    githubIssueNumber: integer('github_issue_number').notNull(),
    title: text('title').notNull(),
    bodyExcerpt: text('body_excerpt'),
    difficulty: text('difficulty', { enum: ['E', 'M', 'H'] }),
    difficultySource: text('difficulty_source', {
      enum: ['label', 'heuristic', 'llm', 'maintainer'],
    }),
    xpReward: integer('xp_reward'),
    labels: text('labels').array(),
    state: text('state', { enum: ['open', 'closed'] })
      .notNull()
      .default('open'),
    url: text('url').notNull(),
    repoHealthScore: integer('repo_health_score'),
    repoLanguage: text('repo_language'),
    summary: text('summary'),
    scoredAt: timestamp('scored_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
    // Maintainer-side triage fields (populated by webhook ingestion).
    githubIssueId: bigint('github_issue_id', { mode: 'number' }),
    authorLogin: text('author_login'),
    assigneeLogin: text('assignee_login'),
    commentsCount: integer('comments_count').notNull().default(0),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    githubCreatedAt: timestamp('github_created_at', { withTimezone: true }),
    githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }),
    lastEventAt: timestamp('last_event_at', { withTimezone: true }),
  },
  (t) => ({
    repoIssueUnique: uniqueIndex('issues_repo_number_unique').on(
      t.repoFullName,
      t.githubIssueNumber,
    ),
    stateDiffIdx: index('issues_state_diff_idx').on(t.state, t.difficulty, t.repoHealthScore),
  }),
);

// ---------- recommendations ----------

export const recommendations = pgTable(
  'recommendations',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    issueId: bigint('issue_id', { mode: 'number' })
      .notNull()
      .references(() => issues.id),
    difficulty: text('difficulty', { enum: ['E', 'M', 'H'] }).notNull(),
    xpReward: integer('xp_reward').notNull(),
    linkedPrUrl: text('linked_pr_url'),
    recommendedAt: timestamp('recommended_at', { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    claimedAt: timestamp('claimed_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    status: text('status', {
      enum: ['open', 'claimed', 'completed', 'expired', 'reassigned'],
    })
      .notNull()
      .default('open'),
  },
  (t) => ({
    uniqUserIssue: uniqueIndex('recs_user_issue_unique').on(t.userId, t.issueId),
    userStatusIdx: index('recs_user_status_idx').on(t.userId, t.status, t.recommendedAt),
  }),
);

// ---------- XP events (append-only, source of truth) ----------

export const xpEvents = pgTable(
  'xp_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    source: text('source').notNull(),
    refType: text('ref_type'),
    refId: text('ref_id').notNull(),
    repo: text('repo'),
    difficulty: text('difficulty', { enum: ['E', 'M', 'H'] }),
    xpDelta: integer('xp_delta').notNull(),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    // The bedrock: every duplicate event silently no-ops.
    idempotency: uniqueIndex('xp_events_idempotency').on(t.userId, t.source, t.refId),
    userTimeIdx: index('xp_events_user_time_idx').on(t.userId, t.createdAt),
  }),
);

// ---------- daily caps tracking ----------

export const xpDailyUsage = pgTable(
  'xp_daily_usage',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    date: date('date').notNull(),
    action: text('action').notNull(),
    count: integer('count').notNull().default(0),
    xpEarned: integer('xp_earned').notNull().default(0),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.date, t.action] }),
  }),
);

// ---------- level ups ----------

export const levelUps = pgTable(
  'level_ups',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    fromLevel: integer('from_level').notNull(),
    toLevel: integer('to_level').notNull(),
    occurredAt: timestamp('occurred_at', { withTimezone: true }).notNull().defaultNow(),
    acknowledged: boolean('acknowledged').notNull().default(false),
  },
  (t) => ({
    userTimeIdx: index('level_ups_user_time_idx').on(t.userId, t.occurredAt),
  }),
);

// ---------- help requests ----------

export const helpRequests = pgTable(
  'help_requests',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    recommendationId: bigint('recommendation_id', { mode: 'number' }).references(
      () => recommendations.id,
    ),
    prUrl: text('pr_url').notNull(),
    reason: text('reason'),
    status: text('status', {
      enum: ['open', 'escalated', 'resolved', 'expired'],
    })
      .notNull()
      .default('open'),
    resolvedBy: uuid('resolved_by').references(() => profiles.id),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    resolvedAt: timestamp('resolved_at', { withTimezone: true }),
  },
  (t) => ({
    userStatusIdx: index('help_requests_user_status_idx').on(t.userId, t.status),
    prActiveIdx: index('help_requests_pr_active_idx').on(t.prUrl, t.status),
  }),
);

// ---------- cohorts + tags ----------

export const cohorts = pgTable('cohorts', {
  id: bigserial('id', { mode: 'number' }).primaryKey(),
  slug: text('slug').notNull().unique(),
  name: text('name').notNull(),
  startsAt: date('starts_at'),
  endsAt: date('ends_at'),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
});

export const cohortMembers = pgTable(
  'cohort_members',
  {
    cohortId: bigint('cohort_id', { mode: 'number' })
      .notNull()
      .references(() => cohorts.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    joinedAt: timestamp('joined_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.cohortId, t.userId] }),
    userIdx: index('cohort_members_user_idx').on(t.userId),
  }),
);

export const profileTags = pgTable(
  'profile_tags',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    tag: text('tag').notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.tag] }),
    tagIdx: index('profile_tags_tag_idx').on(t.tag),
  }),
);

// ---------- webhook idempotency ----------

export const webhookDeliveries = pgTable('webhook_deliveries', {
  id: text('id').primaryKey(),
  eventType: text('event_type').notNull(),
  payloadHash: text('payload_hash').notNull(),
  receivedAt: timestamp('received_at', { withTimezone: true }).notNull().defaultNow(),
  processedAt: timestamp('processed_at', { withTimezone: true }),
});

// ---------- activity log (30d retention) ----------

export const activityLog = pgTable(
  'activity_log',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    userId: uuid('user_id').references(() => profiles.id, { onDelete: 'cascade' }),
    kind: text('kind').notNull(),
    detail: jsonb('detail'),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userTimeIdx: index('activity_log_user_time_idx').on(t.userId, t.createdAt),
    createdAtIdx: index('activity_log_created_at_idx').on(t.createdAt),
  }),
);

// ========================================================================
// Maintainer-side tables (migration 0005)
// ========================================================================

export const pullRequests = pgTable(
  'pull_requests',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    githubPrId: bigint('github_pr_id', { mode: 'number' }).notNull().unique(),
    repoFullName: text('repo_full_name').notNull(),
    number: integer('number').notNull(),
    title: text('title').notNull(),
    bodyExcerpt: text('body_excerpt'),
    authorLogin: text('author_login').notNull(),
    authorUserId: uuid('author_user_id').references(() => profiles.id, { onDelete: 'set null' }),
    state: text('state', { enum: ['open', 'closed', 'merged'] }).notNull(),
    draft: boolean('draft').notNull().default(false),
    url: text('url').notNull(),
    githubCreatedAt: timestamp('github_created_at', { withTimezone: true }).notNull(),
    githubUpdatedAt: timestamp('github_updated_at', { withTimezone: true }).notNull(),
    mergedAt: timestamp('merged_at', { withTimezone: true }),
    closedAt: timestamp('closed_at', { withTimezone: true }),
    mentorVerified: boolean('mentor_verified').notNull().default(false),
    mentorReviewerId: uuid('mentor_reviewer_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    mentorReviewAt: timestamp('mentor_review_at', { withTimezone: true }),
    mentorCommentId: bigint('mentor_comment_id', { mode: 'number' }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqRepoNumber: uniqueIndex('pull_requests_repo_number_unique').on(t.repoFullName, t.number),
    repoStateIdx: index('pull_requests_repo_state_idx').on(
      t.repoFullName,
      t.state,
      t.githubUpdatedAt,
    ),
    authorIdx: index('pull_requests_author_idx').on(t.authorUserId, t.state),
  }),
);

export const pullRequestReviews = pgTable(
  'pull_request_reviews',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    prId: bigint('pr_id', { mode: 'number' })
      .notNull()
      .references(() => pullRequests.id, { onDelete: 'cascade' }),
    githubReviewId: bigint('github_review_id', { mode: 'number' }).notNull().unique(),
    reviewerLogin: text('reviewer_login').notNull(),
    reviewerUserId: uuid('reviewer_user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    state: text('state', {
      enum: ['approved', 'changes_requested', 'commented', 'dismissed', 'pending'],
    }).notNull(),
    bodyExcerpt: text('body_excerpt'),
    isMentor: boolean('is_mentor').notNull().default(false),
    submittedAt: timestamp('submitted_at', { withTimezone: true }).notNull(),
  },
  (t) => ({
    prMentorIdx: index('pull_request_reviews_pr_mentor_idx').on(t.prId, t.isMentor),
    reviewerIdx: index('pull_request_reviews_reviewer_idx').on(t.reviewerUserId, t.submittedAt),
  }),
);

export const githubInstallationUsers = pgTable(
  'github_installation_users',
  {
    installationId: bigint('installation_id', { mode: 'number' })
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    permissionLevel: text('permission_level', {
      enum: ['org_admin', 'repo_admin', 'repo_maintain'],
    }).notNull(),
    source: text('source', {
      enum: ['install_creator', 'membership_check', 'manual_invite'],
    }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.installationId, t.userId] }),
    userIdx: index('github_installation_users_user_idx').on(t.userId),
  }),
);

export const installationUserRepos = pgTable(
  'installation_user_repos',
  {
    installationId: bigint('installation_id', { mode: 'number' })
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    repoFullName: text('repo_full_name').notNull(),
    permissionLevel: text('permission_level', { enum: ['admin', 'maintain'] }).notNull(),
    verifiedAt: timestamp('verified_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.installationId, t.userId, t.repoFullName] }),
    userIdx: index('installation_user_repos_user_idx').on(t.userId),
  }),
);

export const orgCommunities = pgTable(
  'org_communities',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    installationId: bigint('installation_id', { mode: 'number' })
      .notNull()
      .references(() => githubInstallations.id, { onDelete: 'cascade' }),
    kind: text('kind', {
      enum: ['discord', 'slack', 'forum', 'website', 'twitter', 'other'],
    }).notNull(),
    url: text('url').notNull(),
    label: text('label'),
    createdByUserId: uuid('created_by_user_id').references(() => profiles.id, {
      onDelete: 'set null',
    }),
    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    uniqInstallKind: uniqueIndex('org_communities_install_kind_unique').on(
      t.installationId,
      t.kind,
    ),
    installIdx: index('org_communities_install_idx').on(t.installationId),
  }),
);

// ---------- failed webhook events (dead letter queue) ----------

export const failedWebhookEvents = pgTable(
  'failed_webhook_events',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),

    deliveryId: text('delivery_id').notNull(),

    eventType: text('event_type').notNull(),

    source: text('source').notNull(), // e.g. github/pull_request

    payload: jsonb('payload').notNull(),

    error: text('error').notNull(),

    retryCount: integer('retry_count').notNull().default(0),

    createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    deliveryIdx: index('failed_webhook_delivery_idx').on(t.deliveryId),
    eventTypeIdx: index('failed_webhook_event_type_idx').on(t.eventType),
  }),
);
