import { describe, expect, it } from 'vitest';
import { bucketPrVolumeTimeSeries } from './pr-volume-bucketing';
import type { AnalyticsRange } from './analytics-range';

type PrInput = {
  mergedAt: Date | null;
  closedAt: Date | null;
  aiFlagged: boolean;
  githubUpdatedAt: Date;
  githubCreatedAt: Date;
};

function makePr(overrides: Partial<PrInput> = {}): PrInput {
  const created = new Date('2026-01-01T12:00:00.000Z');
  return {
    mergedAt: null,
    closedAt: null,
    aiFlagged: false,
    githubUpdatedAt: created,
    githubCreatedAt: created,
    ...overrides,
  };
}

function run(prs: PrInput[], range: AnalyticsRange, from: string, to: string, now = to) {
  return bucketPrVolumeTimeSeries(prs, range, new Date(from), new Date(to), new Date(now));
}

// Bucket labels are locale-formatted; the ISO date pins the exact bucket.
function byIso(buckets: ReturnType<typeof bucketPrVolumeTimeSeries>) {
  return Object.fromEntries(buckets.map((b) => [b.dateIso, b]));
}

describe('bucketPrVolumeTimeSeries', () => {
  describe('bucket layout', () => {
    it('creates one bucket per day for the 7d range', () => {
      const buckets = run([], '7d', '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z');

      expect(buckets).toHaveLength(7);
      expect(buckets.map((b) => b.dateIso)).toEqual([
        '2026-01-01',
        '2026-01-02',
        '2026-01-03',
        '2026-01-04',
        '2026-01-05',
        '2026-01-06',
        '2026-01-07',
      ]);
    });

    it('starts every counter at zero with no PRs', () => {
      const buckets = run([], '7d', '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z');

      for (const b of buckets) {
        expect(b.merged).toBe(0);
        expect(b.aiBlocked).toBe(0);
        expect(b.stalled).toBe(0);
      }
    });

    it('labels daily buckets as "Mon D" and returns them in chronological order', () => {
      const buckets = run([], '7d', '2026-01-01T00:00:00.000Z', '2026-01-08T00:00:00.000Z');

      expect(buckets[0]!.date).toBe('Jan 1');
      for (const b of buckets) {
        expect(b.date).toMatch(/^[A-Z][a-z]{2} \d{1,2}$/);
      }
      const isos = buckets.map((b) => b.dateIso);
      expect([...isos].sort()).toEqual(isos);
    });

    it('uses weekly buckets for the 90d range', () => {
      const buckets = run([], '90d', '2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

      expect(buckets).toHaveLength(13);
      expect(buckets[0]!.dateIso).toBe('2026-01-01');
      expect(buckets[1]!.dateIso).toBe('2026-01-08');
      expect(buckets[12]!.dateIso).toBe('2026-03-26');
    });

    it('uses monthly buckets labeled "Mon YYYY" for the all range', () => {
      const buckets = run([], 'all', '2026-01-01T00:00:00.000Z', '2026-04-01T00:00:00.000Z');

      expect(buckets).toHaveLength(3);
      expect(buckets.map((b) => [b.date, b.dateIso])).toEqual([
        ['Jan 2026', '2026-01-01'],
        ['Feb 2026', '2026-02-01'],
        ['Mar 2026', '2026-03-01'],
      ]);
    });

    it('does not mutate the from, to, or now arguments', () => {
      const from = new Date('2026-01-01T00:00:00.000Z');
      const to = new Date('2026-01-08T00:00:00.000Z');
      const now = new Date('2026-01-08T00:00:00.000Z');

      bucketPrVolumeTimeSeries([makePr()], '7d', from, to, now);

      expect(from.getTime()).toBe(new Date('2026-01-01T00:00:00.000Z').getTime());
      expect(to.getTime()).toBe(new Date('2026-01-08T00:00:00.000Z').getTime());
      expect(now.getTime()).toBe(new Date('2026-01-08T00:00:00.000Z').getTime());
    });
  });

  describe('merged counts', () => {
    const window = {
      range: '7d' as const,
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-08T00:00:00.000Z',
    };

    it('counts a merged PR in the bucket containing its mergedAt', () => {
      const buckets = byIso(
        run(
          [makePr({ mergedAt: new Date('2026-01-03T12:00:00.000Z') })],
          window.range,
          window.from,
          window.to,
        ),
      );

      expect(buckets['2026-01-03']!.merged).toBe(1);
      expect(buckets['2026-01-04']!.merged).toBe(0);
    });

    it('ignores merges that fall outside the window', () => {
      const prs = [
        makePr({ mergedAt: new Date('2025-12-31T23:59:00.000Z') }),
        makePr({ mergedAt: new Date('2026-01-08T00:00:00.000Z') }),
      ];
      const buckets = run(prs, window.range, window.from, window.to);

      expect(buckets.reduce((sum, b) => sum + b.merged, 0)).toBe(0);
    });

    it('puts a weekly-bucketed merge in the right week for 90d', () => {
      const buckets = byIso(
        run(
          [makePr({ mergedAt: new Date('2026-01-10T12:00:00.000Z') })],
          '90d',
          '2026-01-01T00:00:00.000Z',
          '2026-04-01T00:00:00.000Z',
        ),
      );

      expect(buckets['2026-01-08']!.merged).toBe(1);
      expect(buckets['2026-01-01']!.merged).toBe(0);
    });

    it('puts a monthly-bucketed merge in the right month for all', () => {
      const buckets = byIso(
        run(
          [makePr({ mergedAt: new Date('2026-02-10T12:00:00.000Z') })],
          'all',
          '2026-01-01T00:00:00.000Z',
          '2026-04-01T00:00:00.000Z',
        ),
      );

      expect(buckets['2026-02-01']!.merged).toBe(1);
    });
  });

  describe('aiBlocked counts', () => {
    it('counts a flagged PR in the bucket containing its creation date', () => {
      const buckets = byIso(
        run(
          [
            makePr({
              aiFlagged: true,
              githubCreatedAt: new Date('2026-01-05T09:00:00.000Z'),
            }),
          ],
          '7d',
          '2026-01-01T00:00:00.000Z',
          '2026-01-08T00:00:00.000Z',
        ),
      );

      expect(buckets['2026-01-05']!.aiBlocked).toBe(1);
      expect(buckets['2026-01-01']!.aiBlocked).toBe(0);
    });

    it('skips unflagged PRs', () => {
      const buckets = run(
        [makePr({ aiFlagged: false })],
        '7d',
        '2026-01-01T00:00:00.000Z',
        '2026-01-08T00:00:00.000Z',
      );

      expect(buckets.reduce((sum, b) => sum + b.aiBlocked, 0)).toBe(0);
    });
  });

  describe('stalled counts', () => {
    it('counts a PR as stalled in every bucket once 14 days pass without an update', () => {
      // now sits after the window end so the PR is still open at each bucket end
      const buckets = run(
        [
          makePr({
            githubCreatedAt: new Date('2026-01-01T12:00:00.000Z'),
            githubUpdatedAt: new Date('2026-01-01T12:00:00.000Z'),
          }),
        ],
        '7d',
        '2026-02-01T00:00:00.000Z',
        '2026-02-08T00:00:00.000Z',
        '2026-02-09T00:00:00.000Z',
      );

      for (const b of buckets) {
        expect(b.stalled).toBe(1);
      }
    });

    it('does not count a recently updated PR as stalled', () => {
      const buckets = run(
        [
          makePr({
            githubCreatedAt: new Date('2026-02-01T12:00:00.000Z'),
            githubUpdatedAt: new Date('2026-02-06T12:00:00.000Z'),
          }),
        ],
        '7d',
        '2026-02-01T00:00:00.000Z',
        '2026-02-08T00:00:00.000Z',
        '2026-02-08T00:00:00.000Z',
      );

      expect(buckets.reduce((sum, b) => sum + b.stalled, 0)).toBe(0);
    });

    it('stops counting a PR as stalled after it is closed', () => {
      const buckets = byIso(
        run(
          [
            makePr({
              githubCreatedAt: new Date('2026-01-01T12:00:00.000Z'),
              githubUpdatedAt: new Date('2026-01-01T12:00:00.000Z'),
              closedAt: new Date('2026-02-04T12:00:00.000Z'),
            }),
          ],
          '7d',
          '2026-02-01T00:00:00.000Z',
          '2026-02-08T00:00:00.000Z',
          '2026-02-08T00:00:00.000Z',
        ),
      );

      expect(buckets['2026-02-01']!.stalled).toBe(1);
      expect(buckets['2026-02-02']!.stalled).toBe(1);
      expect(buckets['2026-02-03']!.stalled).toBe(1);
      expect(buckets['2026-02-04']!.stalled).toBe(0);
      expect(buckets['2026-02-05']!.stalled).toBe(0);
    });

    it('never counts a PR closed before the window as stalled', () => {
      const buckets = run(
        [
          makePr({
            githubCreatedAt: new Date('2026-01-01T12:00:00.000Z'),
            githubUpdatedAt: new Date('2026-01-01T12:00:00.000Z'),
            closedAt: new Date('2026-01-20T12:00:00.000Z'),
          }),
        ],
        '7d',
        '2026-02-01T00:00:00.000Z',
        '2026-02-08T00:00:00.000Z',
        '2026-02-08T00:00:00.000Z',
      );

      expect(buckets.reduce((sum, b) => sum + b.stalled, 0)).toBe(0);
    });
  });
});
