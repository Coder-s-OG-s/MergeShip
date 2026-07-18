export type AnalyticsRange = '7d' | '30d' | '90d' | 'all';

export function parseRange(raw: string | undefined): AnalyticsRange {
  if (raw === '7d' || raw === '30d' || raw === '90d' || raw === 'all') return raw;
  return '30d'; // default
}

export function rangeToDateBounds(range: AnalyticsRange, now: Date): { from: Date; to: Date } {
  const to = new Date(now.getTime());
  const from = new Date(now.getTime());

  if (range === '7d') {
    from.setDate(from.getDate() - 7);
  } else if (range === '30d') {
    from.setDate(from.getDate() - 30);
  } else if (range === '90d') {
    from.setDate(from.getDate() - 90);
  } else {
    // 'all' uses a far past date (e.g. 2000-01-01) or whatever works for early limits
    from.setFullYear(2000, 0, 1);
  }

  return { from, to };
}
