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
};

export type AnalyticsMergedPullRequest = {
  mergedAt: string | null;
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

  return { weekly, levelDistribution, avgReviewTimeHours: args.avgReviewTimeHours ?? null };
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

export type LevelSnapshot = { l0: number; l1: number; l2: number; l3Plus: number };

export function buildCurrentLevelSnapshot(contributors: { level: number }[]): LevelSnapshot {
  const snapshot: LevelSnapshot = { l0: 0, l1: 0, l2: 0, l3Plus: 0 };
  for (const c of contributors) {
    const level = c.level;
    if (level <= 0) snapshot.l0++;
    else if (level === 1) snapshot.l1++;
    else if (level === 2) snapshot.l2++;
    else snapshot.l3Plus++;
  }
  return snapshot;
}
