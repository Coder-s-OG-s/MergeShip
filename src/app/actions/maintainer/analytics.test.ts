import { describe, it, expect } from 'vitest';
import { bucketPrVolumeTimeSeries } from './analytics';

describe('bucketPrVolumeTimeSeries', () => {
  it('buckets merged PRs correctly', () => {
    const from = new Date('2026-07-01T00:00:00.000Z');
    const to = new Date('2026-07-08T00:00:00.000Z');
    const now = new Date('2026-07-08T00:00:00.000Z');

    const prs = [
      {
        mergedAt: new Date('2026-07-02T12:00:00.000Z'),
        closedAt: new Date('2026-07-02T12:00:00.000Z'),
        aiFlagged: false,
        githubCreatedAt: new Date('2026-07-01T12:00:00.000Z'),
        githubUpdatedAt: new Date('2026-07-02T12:00:00.000Z'),
      },
      {
        mergedAt: new Date('2026-07-03T15:00:00.000Z'),
        closedAt: new Date('2026-07-03T15:00:00.000Z'),
        aiFlagged: false,
        githubCreatedAt: new Date('2026-07-02T12:00:00.000Z'),
        githubUpdatedAt: new Date('2026-07-03T15:00:00.000Z'),
      },
    ];

    const buckets = bucketPrVolumeTimeSeries(prs, '7d', from, to, now);

    // There should be 7 buckets for a 7d range
    expect(buckets.length).toBe(7);

    const day2Bucket = buckets.find((b) => b.dateIso === '2026-07-02');
    const day3Bucket = buckets.find((b) => b.dateIso === '2026-07-03');
    const day4Bucket = buckets.find((b) => b.dateIso === '2026-07-04');

    expect(day2Bucket?.merged).toBe(1);
    expect(day3Bucket?.merged).toBe(1);
    expect(day4Bucket?.merged).toBe(0);
  });

  it('calculates stalled PRs correctly using a rolling window', () => {
    // 30 day window ending on Aug 1
    const from = new Date('2026-07-02T00:00:00.000Z');
    const to = new Date('2026-08-01T00:00:00.000Z');
    const now = new Date('2026-08-01T00:00:00.000Z');

    const prs = [
      {
        // Stalled PR: untouched since June 15th
        mergedAt: null,
        closedAt: null,
        aiFlagged: false,
        githubCreatedAt: new Date('2026-06-15T00:00:00.000Z'),
        githubUpdatedAt: new Date('2026-06-15T00:00:00.000Z'),
      },
      {
        // PR updated recently, never stalled
        mergedAt: null,
        closedAt: null,
        aiFlagged: false,
        githubCreatedAt: new Date('2026-07-20T00:00:00.000Z'),
        githubUpdatedAt: new Date('2026-07-25T00:00:00.000Z'),
      },
      {
        // PR that became stalled during the window (created July 1st, untouched)
        // Starts stalling July 15th (14 days after July 1st)
        mergedAt: null,
        closedAt: null,
        aiFlagged: false,
        githubCreatedAt: new Date('2026-07-01T00:00:00.000Z'),
        githubUpdatedAt: new Date('2026-07-01T00:00:00.000Z'),
      },
    ];

    const buckets = bucketPrVolumeTimeSeries(prs, '30d', from, to, now);

    expect(buckets.length).toBe(30);

    // Bucket for July 5th
    const bucketJul5 = buckets.find((b) => b.dateIso === '2026-07-05');
    // The first PR (June 15th) is stalled here because it has been >14 days
    // The second PR (July 20th) hasn't been created yet
    // The third PR (July 1st) is NOT stalled yet, it's only been 4 days
    expect(bucketJul5?.stalled).toBe(1);

    // Bucket for July 16th
    const bucketJul16 = buckets.find((b) => b.dateIso === '2026-07-16');
    // The first PR (June 15th) is still stalled
    // The second PR (July 20th) hasn't been created yet
    // The third PR (July 1st) IS NOW stalled! (July 16 > July 15)
    expect(bucketJul16?.stalled).toBe(2);
  });
});
