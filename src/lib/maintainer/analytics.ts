export type WeeklyMaintainerTrend = {
  weekStart: string;
  label: string;
  mergedPrs: number;
  xpDistributed: number;
};

export type LevelDistributionTrend = {
  monthStart: string;
  label: string;
  l0: number;
  l1: number;
  l2: number;
  l3Plus: number;
};

export type MaintainerAnalyticsTrends = {
  weekly: WeeklyMaintainerTrend[];
  levelDistribution: LevelDistributionTrend[];
  avgReviewTimeHours: number | null;
  dayOverDay: MaintainerDayOverDayStats;
};

export type MaintainerDayOverDayMetric = {
  current: number | null;
  previous: number | null;
  delta: number | null;
  direction: 'up' | 'down' | 'flat';
};

export type MaintainerDayOverDayStats = {
  openedPrs: MaintainerDayOverDayMetric;
  mergedPrs: MaintainerDayOverDayMetric;
  mentorReviews: MaintainerDayOverDayMetric;
  avgReviewTimeHours: MaintainerDayOverDayMetric;
};

export type AnalyticsMergedPullRequest = {
  githubCreatedAt?: string | null;
  mergedAt: string | null;
  mentorReviewAt?: string | null;
};

export type AnalyticsCompletedRecommendation = {
  completedAt: string | null;
  xpReward: number | null;
};

export type AnalyticsContributorProfile = {
  id: string;
  level: number | null;
  createdAt: string | null;
};

export type AnalyticsLevelUp = {
  userId: string;
  fromLevel: number;
  toLevel: number;
  occurredAt: string;
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildMaintainerAnalyticsTrends(args: {
  now: Date;
  mergedPullRequests: AnalyticsMergedPullRequest[];
  completedRecommendations: AnalyticsCompletedRecommendation[];
  contributorProfiles: AnalyticsContributorProfile[];
  levelUps: AnalyticsLevelUp[];
  avgReviewTimeHours?: number | null;
}): MaintainerAnalyticsTrends {
  const weekly = buildWeeklyTrends(
    args.now,
    args.mergedPullRequests,
    args.completedRecommendations,
  );
  const levelDistribution = buildLevelDistribution(
    args.now,
    args.contributorProfiles,
    args.levelUps,
  );

  return {
    weekly,
    levelDistribution,
    avgReviewTimeHours: args.avgReviewTimeHours ?? null,
    dayOverDay: buildDayOverDayStats(args.now, args.mergedPullRequests),
  };
}

export function emptyMaintainerDayOverDayStats(): MaintainerDayOverDayStats {
  const emptyMetric = makeDayOverDayMetric(null, null);
  return {
    openedPrs: emptyMetric,
    mergedPrs: emptyMetric,
    mentorReviews: emptyMetric,
    avgReviewTimeHours: emptyMetric,
  };
}

function buildWeeklyTrends(
  now: Date,
  mergedPullRequests: AnalyticsMergedPullRequest[],
  completedRecommendations: AnalyticsCompletedRecommendation[],
): WeeklyMaintainerTrend[] {
  const currentWeekStart = startOfUtcWeek(now);
  const weekStarts = Array.from({ length: 12 }, (_, index) => {
    return new Date(currentWeekStart.getTime() - (11 - index) * WEEK_MS);
  });
  const rows = weekStarts.map((weekStart) => ({
    weekStart: isoDate(weekStart),
    label: shortDate(weekStart),
    mergedPrs: 0,
    xpDistributed: 0,
  }));
  const rowByWeek = new Map(rows.map((row) => [row.weekStart, row]));

  for (const pr of mergedPullRequests) {
    if (!pr.mergedAt) continue;
    const weekKey = isoDate(startOfUtcWeek(new Date(pr.mergedAt)));
    const row = rowByWeek.get(weekKey);
    if (row) row.mergedPrs += 1;
  }

  for (const rec of completedRecommendations) {
    if (!rec.completedAt) continue;
    const weekKey = isoDate(startOfUtcWeek(new Date(rec.completedAt)));
    const row = rowByWeek.get(weekKey);
    if (row) row.xpDistributed += rec.xpReward ?? 0;
  }

  return rows;
}

function buildLevelDistribution(
  now: Date,
  contributorProfiles: AnalyticsContributorProfile[],
  levelUps: AnalyticsLevelUp[],
): LevelDistributionTrend[] {
  const monthStarts = Array.from({ length: 6 }, (_, index) => {
    const month = now.getUTCMonth() - (5 - index);
    return new Date(Date.UTC(now.getUTCFullYear(), month, 1));
  });
  const levelUpsByUser = new Map<string, AnalyticsLevelUp[]>();

  for (const levelUp of levelUps) {
    const userLevelUps = levelUpsByUser.get(levelUp.userId) ?? [];
    userLevelUps.push(levelUp);
    levelUpsByUser.set(levelUp.userId, userLevelUps);
  }

  for (const userLevelUps of levelUpsByUser.values()) {
    userLevelUps.sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
  }

  return monthStarts.map((monthStart) => {
    const monthEnd = endOfUtcMonth(monthStart);
    const snapshotAt = monthEnd.getTime() > now.getTime() ? now : monthEnd;
    const row: LevelDistributionTrend = {
      monthStart: isoDate(monthStart),
      label: monthLabel(monthStart),
      l0: 0,
      l1: 0,
      l2: 0,
      l3Plus: 0,
    };

    for (const profile of contributorProfiles) {
      if (profile.createdAt && Date.parse(profile.createdAt) > snapshotAt.getTime()) {
        continue;
      }

      const level = levelAtSnapshot(
        profile.level ?? 0,
        levelUpsByUser.get(profile.id) ?? [],
        snapshotAt,
      );
      if (level <= 0) row.l0 += 1;
      else if (level === 1) row.l1 += 1;
      else if (level === 2) row.l2 += 1;
      else row.l3Plus += 1;
    }

    return row;
  });
}

export function buildDayOverDayStats(
  now: Date,
  pullRequests: AnalyticsMergedPullRequest[],
): MaintainerDayOverDayStats {
  const todayStart = startOfUtcDay(now);
  const tomorrowStart = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);
  const yesterdayStart = new Date(todayStart.getTime() - 24 * 60 * 60 * 1000);

  const todayReviewDurations: number[] = [];
  const yesterdayReviewDurations: number[] = [];

  let openedToday = 0;
  let openedYesterday = 0;
  let mergedToday = 0;
  let mergedYesterday = 0;
  let reviewedToday = 0;
  let reviewedYesterday = 0;

  for (const pr of pullRequests) {
    if (isInUtcRange(pr.githubCreatedAt, todayStart, tomorrowStart)) openedToday += 1;
    else if (isInUtcRange(pr.githubCreatedAt, yesterdayStart, todayStart)) openedYesterday += 1;

    if (isInUtcRange(pr.mergedAt, todayStart, tomorrowStart)) mergedToday += 1;
    else if (isInUtcRange(pr.mergedAt, yesterdayStart, todayStart)) mergedYesterday += 1;

    if (isInUtcRange(pr.mentorReviewAt, todayStart, tomorrowStart)) {
      reviewedToday += 1;
      const duration = reviewDurationHours(pr);
      if (duration !== null) todayReviewDurations.push(duration);
    } else if (isInUtcRange(pr.mentorReviewAt, yesterdayStart, todayStart)) {
      reviewedYesterday += 1;
      const duration = reviewDurationHours(pr);
      if (duration !== null) yesterdayReviewDurations.push(duration);
    }
  }

  return {
    openedPrs: makeDayOverDayMetric(openedToday, openedYesterday),
    mergedPrs: makeDayOverDayMetric(mergedToday, mergedYesterday),
    mentorReviews: makeDayOverDayMetric(reviewedToday, reviewedYesterday),
    avgReviewTimeHours: makeDayOverDayMetric(
      averageOrNull(todayReviewDurations),
      averageOrNull(yesterdayReviewDurations),
    ),
  };
}

function levelAtSnapshot(currentLevel: number, userLevelUps: AnalyticsLevelUp[], snapshotAt: Date) {
  let level = currentLevel;
  const snapshotTime = snapshotAt.getTime();

  for (const levelUp of userLevelUps) {
    if (Date.parse(levelUp.occurredAt) > snapshotTime) {
      level = levelUp.fromLevel;
    }
  }

  return level;
}

function startOfUtcWeek(date: Date): Date {
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
  const daysSinceMonday = (start.getUTCDay() + 6) % 7;
  start.setUTCDate(start.getUTCDate() - daysSinceMonday);
  return start;
}

function startOfUtcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isInUtcRange(value: string | null | undefined, start: Date, end: Date): boolean {
  if (!value) return false;
  const time = Date.parse(value);
  return Number.isFinite(time) && time >= start.getTime() && time < end.getTime();
}

function reviewDurationHours(pr: AnalyticsMergedPullRequest): number | null {
  if (!pr.githubCreatedAt || !pr.mentorReviewAt) return null;
  const created = Date.parse(pr.githubCreatedAt);
  const reviewed = Date.parse(pr.mentorReviewAt);
  if (!Number.isFinite(created) || !Number.isFinite(reviewed) || reviewed < created) return null;
  return (reviewed - created) / (60 * 60 * 1000);
}

function averageOrNull(values: number[]): number | null {
  if (values.length === 0) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function makeDayOverDayMetric(
  current: number | null,
  previous: number | null,
): MaintainerDayOverDayMetric {
  const delta = current !== null && previous !== null ? current - previous : null;
  return {
    current,
    previous,
    delta,
    direction: delta === null || delta === 0 ? 'flat' : delta > 0 ? 'up' : 'down',
  };
}

function endOfUtcMonth(monthStart: Date): Date {
  return new Date(Date.UTC(monthStart.getUTCFullYear(), monthStart.getUTCMonth() + 1, 1) - 1);
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function shortDate(date: Date): string {
  return new Intl.DateTimeFormat('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
    date,
  );
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en', { month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
    date,
  );
}
