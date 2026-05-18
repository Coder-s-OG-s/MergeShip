export type PrAnalyticsRow = {
  id: number;
  state: 'open' | 'closed' | 'merged';
  authorUserId: string | null;
  githubCreatedAt: string;
  githubUpdatedAt: string;
  mergedAt: string | null;
};

export type RecommendationAnalyticsRow = {
  xpReward: number;
  completedAt: string | null;
};

export type ProfileAnalyticsRow = {
  id: string;
  level: number | null;
  createdAt: string;
};

export type WeeklyAnalyticsPoint = {
  label: string;
  start: string;
  mergedPrs: number;
  xpDistributed: number;
};

export type LevelDistributionPoint = {
  label: string;
  monthStart: string;
  l0: number;
  l1: number;
  l2: number;
  l3Plus: number;
};

export type MaintainerAnalytics = {
  generatedAt: string;
  totals: {
    mergedPrs12w: number;
    xpDistributed12w: number;
    activeContributors12w: number;
    mergeRatePerWeek: number;
  };
  weekly: WeeklyAnalyticsPoint[];
  levelDistribution: LevelDistributionPoint[];
};

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export function buildMaintainerAnalytics(args: {
  prs: PrAnalyticsRow[];
  recommendations: RecommendationAnalyticsRow[];
  profiles: ProfileAnalyticsRow[];
  now?: Date;
}): MaintainerAnalytics {
  const now = args.now ?? new Date();
  const weekStarts = buildWeekStarts(now, 12);
  const weekly = weekStarts.map((start) => ({
    label: shortDate(start),
    start: start.toISOString(),
    mergedPrs: 0,
    xpDistributed: 0,
  }));

  const firstWeek = weekStarts[0]!;
  const activeContributorIds = new Set<string>();

  for (const pr of args.prs) {
    const updated = parseDate(pr.githubUpdatedAt);
    if (pr.authorUserId && updated && updated >= firstWeek && updated <= now) {
      activeContributorIds.add(pr.authorUserId);
    }

    if (pr.state !== 'merged' || !pr.mergedAt) continue;
    const merged = parseDate(pr.mergedAt);
    const idx = merged ? weekIndex(merged, weekStarts) : -1;
    if (idx >= 0) weekly[idx]!.mergedPrs += 1;
  }

  for (const rec of args.recommendations) {
    if (!rec.completedAt) continue;
    const completed = parseDate(rec.completedAt);
    const idx = completed ? weekIndex(completed, weekStarts) : -1;
    if (idx >= 0) weekly[idx]!.xpDistributed += rec.xpReward;
  }

  const monthStarts = buildMonthStarts(now, 6);
  const levelDistribution = monthStarts.map((monthStart) => {
    const monthEnd = endOfMonth(monthStart);
    const point: LevelDistributionPoint = {
      label: monthStart.toLocaleDateString('en', { month: 'short' }),
      monthStart: monthStart.toISOString(),
      l0: 0,
      l1: 0,
      l2: 0,
      l3Plus: 0,
    };

    for (const profile of args.profiles) {
      const createdAt = parseDate(profile.createdAt);
      if (!createdAt || createdAt > monthEnd) continue;
      const level = profile.level ?? 0;
      if (level <= 0) point.l0 += 1;
      else if (level === 1) point.l1 += 1;
      else if (level === 2) point.l2 += 1;
      else point.l3Plus += 1;
    }

    return point;
  });

  const mergedPrs12w = weekly.reduce((sum, point) => sum + point.mergedPrs, 0);
  const xpDistributed12w = weekly.reduce((sum, point) => sum + point.xpDistributed, 0);

  return {
    generatedAt: now.toISOString(),
    totals: {
      mergedPrs12w,
      xpDistributed12w,
      activeContributors12w: activeContributorIds.size,
      mergeRatePerWeek: roundOne(mergedPrs12w / weekly.length),
    },
    weekly,
    levelDistribution,
  };
}

function buildWeekStarts(now: Date, count: number): Date[] {
  const start = startOfUtcDay(new Date(now.getTime() - (count - 1) * WEEK_MS));
  return Array.from({ length: count }, (_, index) => new Date(start.getTime() + index * WEEK_MS));
}

function buildMonthStarts(now: Date, count: number): Date[] {
  const out: Date[] = [];
  for (let offset = count - 1; offset >= 0; offset -= 1) {
    out.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - offset, 1)));
  }
  return out;
}

function weekIndex(value: Date, weekStarts: Date[]): number {
  const first = weekStarts[0]!;
  const last = new Date(weekStarts[weekStarts.length - 1]!.getTime() + WEEK_MS);
  if (value < first || value >= last) return -1;
  return Math.floor((value.getTime() - first.getTime()) / WEEK_MS);
}

function startOfUtcDay(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate()));
}

function endOfMonth(value: Date): Date {
  return new Date(Date.UTC(value.getUTCFullYear(), value.getUTCMonth() + 1, 0, 23, 59, 59, 999));
}

function shortDate(value: Date): string {
  return value.toLocaleDateString('en', { month: 'short', day: 'numeric' });
}

function parseDate(value: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function roundOne(value: number): number {
  return Math.round(value * 10) / 10;
}
