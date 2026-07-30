import type { AnalyticsRange } from './analytics-range';
import type { PrVolumeBucket } from '@/app/actions/maintainer/analytics';

export function bucketPrVolumeTimeSeries(
  prs: {
    mergedAt: Date | null;
    closedAt: Date | null;
    aiFlagged: boolean;
    githubUpdatedAt: Date;
    githubCreatedAt: Date;
  }[],
  range: AnalyticsRange,
  from: Date,
  to: Date,
  now: Date,
): PrVolumeBucket[] {
  // Setup buckets
  const getNextBucket = (d: Date) => {
    const next = new Date(d.getTime());
    if (range === '7d' || range === '30d') {
      next.setDate(next.getDate() + 1);
    } else if (range === '90d') {
      next.setDate(next.getDate() + 7);
    } else {
      next.setMonth(next.getMonth() + 1);
    }
    return next;
  };

  const getBucketKey = (d: Date) => {
    if (range === '7d' || range === '30d' || range === '90d') {
      return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
    return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
  };

  const getIsoDate = (d: Date) => d.toISOString().split('T')[0]!;

  const bucketBoundaries: { start: Date; end: Date; key: string; iso: string }[] = [];
  const buckets: Record<string, PrVolumeBucket> = {};

  let current = new Date(from.getTime());
  while (current < to) {
    const next = getNextBucket(current);
    const end = next > to ? to : next;
    const key = getBucketKey(current);
    const iso = getIsoDate(current);

    bucketBoundaries.push({ start: current, end, key, iso });
    buckets[iso] = {
      date: key,
      dateIso: iso,
      merged: 0,
      aiBlocked: 0,
      stalled: 0,
    };
    current = next;
  }

  // Optimize O(PRs x buckets) into O(PRs + buckets) for discrete events,
  // and tight bounded loops for stalled events.
  const findBucketIndex = (date: Date) => {
    if (date < from || date >= to) return -1;
    // Fast linear scan since max buckets is ~30
    for (let i = 0; i < bucketBoundaries.length; i++) {
      if (date >= bucketBoundaries[i]!.start && date < bucketBoundaries[i]!.end) {
        return i;
      }
    }
    return -1;
  };

  for (const pr of prs) {
    // 1. Merged
    if (pr.mergedAt) {
      const idx = findBucketIndex(pr.mergedAt);
      if (idx !== -1) {
        buckets[bucketBoundaries[idx]!.iso]!.merged++;
      }
    }

    // 2. AI Blocked (using created date as proxy for when it was flagged)
    if (pr.aiFlagged) {
      const idx = findBucketIndex(pr.githubCreatedAt);
      if (idx !== -1) {
        buckets[bucketBoundaries[idx]!.iso]!.aiBlocked++;
      }
    }

    // 3. Stalled
    // A PR is considered stalled starting 14 days after its githubUpdatedAt
    const stallStart = new Date(pr.githubUpdatedAt.getTime());
    stallStart.setDate(stallStart.getDate() + 14);

    // It stops being stalled when it's closed/merged
    const stallEnd = pr.mergedAt || pr.closedAt || now;

    // Check overlap with the [from, to] window
    if (stallStart < to && stallEnd >= from) {
      // It is stalled during some part of our window
      // For each bucket, it is counted as stalled if it was stalled AT bucket.end
      for (let i = 0; i < bucketBoundaries.length; i++) {
        const b = bucketBoundaries[i]!;
        // Was it created before or at bucket.end?
        if (pr.githubCreatedAt <= b.end) {
          // Was it still open at bucket.end?
          if (stallEnd > b.end) {
            // Was it stalled by bucket.end? (githubUpdatedAt + 14d <= b.end)
            if (stallStart <= b.end) {
              buckets[b.iso]!.stalled++;
            }
          }
        }
      }
    }
  }

  return Object.values(buckets);
}
