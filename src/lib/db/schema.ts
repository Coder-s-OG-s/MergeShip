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
    summary: text('summary'),
    scoredAt: timestamp('scored_at', { withTimezone: true }),
    fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
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

// ---------- course progress ----------

export const courseProgress = pgTable(
  'course_progress',
  {
    userId: uuid('user_id')
      .notNull()
      .references(() => profiles.id, { onDelete: 'cascade' }),
    moduleSlug: text('module_slug').notNull(),
    quizScore: integer('quiz_score'),
    completedAt: timestamp('completed_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.userId, t.moduleSlug] }),
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
