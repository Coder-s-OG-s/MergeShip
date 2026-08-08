import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUsage, getWeeklyXp } from './usage';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetServiceSupabase: vi.fn(),
  mockServiceFrom: vi.fn(),
  mockRateLimit: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: mocks.mockGetServerSupabase,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: mocks.mockGetServiceSupabase,
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: mocks.mockRateLimit,
}));

vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }));

/** Build a chainable Supabase query mock with optional terminal result for .single(). */
function makeChain(resolveValue?: unknown) {
  const result = resolveValue ?? { data: null, error: null };
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue(result),
  };
}

describe('getUsage', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    mocks.mockGetServerSupabase.mockReturnValue({
      auth: { getUser: mocks.mockGetUser },
    });
    mocks.mockGetServiceSupabase.mockReturnValue({
      from: mocks.mockServiceFrom,
    });
  });

  it('returns usage data for authenticated user', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    // Three parallel queries: activity_log, xp_events (today), xp_events (week).
    const logChain = makeChain();
    logChain.limit = vi.fn().mockResolvedValue({
      data: [
        { id: 1, kind: 'review', detail: { pr: 42 }, created_at: '2026-07-10T10:00:00Z' },
        { id: 2, kind: 'comment', detail: null, created_at: '2026-07-09T10:00:00Z' },
      ],
      error: null,
    });

    const todayChain = makeChain();
    todayChain.gte = vi.fn().mockResolvedValue({
      data: [{ xp_delta: 50 }, { xp_delta: 30 }],
      error: null,
    });

    const weekChain = makeChain();
    weekChain.gte = vi.fn().mockResolvedValue({
      data: [{ xp_delta: 50 }, { xp_delta: 30 }, { xp_delta: 20 }],
      error: null,
    });

    const chartChain = makeChain();
    chartChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.mockServiceFrom
      .mockReturnValueOnce(logChain) // activity_log
      .mockReturnValueOnce(todayChain) // xp_events today
      .mockReturnValueOnce(weekChain) // xp_events week
      .mockReturnValueOnce(chartChain); // xp_events chart (84 days)

    const result = await getUsage();

    expect(result.todayXp).toBe(80); // 50 + 30
    expect(result.weekXp).toBe(100); // 50 + 30 + 20
    expect(result.weeklyXp).toHaveLength(12); // 12 zero-width weekly buckets
    expect(result.entries).toHaveLength(2);
    expect(result.entries[0]).toEqual({
      id: 1,
      kind: 'review',
      createdAt: '2026-07-10T10:00:00Z',
      detail: { pr: 42 },
    });
  });

  it('uses the current UTC calendar week (Monday 00:00) as the week window', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    const logChain = makeChain();
    logChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });

    const todayChain = makeChain();
    todayChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const weekChain = makeChain();
    const weekGte = vi.fn().mockResolvedValue({ data: [], error: null });
    weekChain.gte = weekGte;

    const chartChain = makeChain();
    chartChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.mockServiceFrom
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(todayChain)
      .mockReturnValueOnce(weekChain)
      .mockReturnValueOnce(chartChain);

    await getUsage();

    const weekBoundary = weekGte.mock.calls[0]?.[1] as string;
    const boundary = new Date(weekBoundary);
    expect(boundary.getUTCDay()).toBe(1); // Monday (UTC)
    expect(weekBoundary).toMatch(/T00:00:00.000Z$/); // start of a calendar day
    expect(boundary.getTime()).toBeLessThanOrEqual(Date.now());
  });

  it('respects limit parameter', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    const logChain = makeChain();
    const limitSpy = vi.fn().mockResolvedValue({
      data: [{ id: 1, kind: 'review', detail: null, created_at: '2026-07-10T10:00:00Z' }],
      error: null,
    });
    logChain.limit = limitSpy;

    const todayChain = makeChain();
    todayChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const weekChain = makeChain();
    weekChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const chartChain = makeChain();
    chartChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.mockServiceFrom
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(todayChain)
      .mockReturnValueOnce(weekChain)
      .mockReturnValueOnce(chartChain);

    await getUsage(5);

    expect(limitSpy).toHaveBeenCalledWith(5);
  });

  it('returns empty entries when no activity', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    const logChain = makeChain();
    logChain.limit = vi.fn().mockResolvedValue({ data: [], error: null });

    const todayChain = makeChain();
    todayChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const weekChain = makeChain();
    weekChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const chartChain = makeChain();
    chartChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.mockServiceFrom
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(todayChain)
      .mockReturnValueOnce(weekChain)
      .mockReturnValueOnce(chartChain);

    const result = await getUsage();

    expect(result.todayXp).toBe(0);
    expect(result.weekXp).toBe(0);
    expect(result.weeklyXp).toHaveLength(12);
    expect(result.entries).toEqual([]);
  });

  it('returns empty summary when not authenticated', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getUsage();

    expect(result).toEqual({ todayXp: 0, weekXp: 0, weeklyXp: [], entries: [] });
    expect(mocks.mockRateLimit).not.toHaveBeenCalled();
  });

  it('returns empty when rate limited', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: false });

    const result = await getUsage();

    expect(result).toEqual({ todayXp: 0, weekXp: 0, weeklyXp: [], entries: [] });
    expect(mocks.mockServiceFrom).not.toHaveBeenCalled();
  });

  it('handles null detail in activity_log entries', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockRateLimit.mockResolvedValue({ ok: true });

    const logChain = makeChain();
    logChain.limit = vi.fn().mockResolvedValue({
      data: [{ id: 1, kind: 'comment', detail: null, created_at: '2026-07-10T10:00:00Z' }],
      error: null,
    });

    const todayChain = makeChain();
    todayChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const weekChain = makeChain();
    weekChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    const chartChain = makeChain();
    chartChain.gte = vi.fn().mockResolvedValue({ data: [], error: null });

    mocks.mockServiceFrom
      .mockReturnValueOnce(logChain)
      .mockReturnValueOnce(todayChain)
      .mockReturnValueOnce(weekChain)
      .mockReturnValueOnce(chartChain);

    const result = await getUsage();

    expect(result.entries).toHaveLength(1);
    expect(result.entries[0]?.detail).toBeNull();
  });
});

describe('getWeeklyXp', () => {
  function utcMonday(d: Date): Date {
    const utc = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
    utc.setUTCDate(utc.getUTCDate() - ((utc.getUTCDay() + 6) % 7));
    return utc;
  }

  function midWeek(monday: Date): Date {
    const d = new Date(monday);
    d.setUTCDate(monday.getUTCDate() + 3); // Wednesday
    return d;
  }

  const key = (d: Date) => d.toISOString().slice(0, 10);

  it('returns 12 zero buckets when there are no events', () => {
    const result = getWeeklyXp([]);

    expect(result).toHaveLength(12);
    expect(result.every((p) => p.xp === 0)).toBe(true);
  });

  it('buckets XP into the current UTC calendar week', () => {
    const thisMonday = utcMonday(new Date());
    const mid = midWeek(thisMonday);

    const result = getWeeklyXp([
      { createdAt: mid.toISOString(), xp: 50 },
      { createdAt: mid.toISOString(), xp: 30 },
    ]);

    expect(result).toHaveLength(12);
    expect(result.find((p) => p.week === key(thisMonday))?.xp).toBe(80);
  });

  it('sums XP across multiple weekly buckets', () => {
    const thisMonday = utcMonday(new Date());
    const lastMonday = new Date(thisMonday);
    lastMonday.setUTCDate(thisMonday.getUTCDate() - 7);
    const twoWeeksAgo = new Date(thisMonday);
    twoWeeksAgo.setUTCDate(thisMonday.getUTCDate() - 14);

    const result = getWeeklyXp([
      { createdAt: midWeek(lastMonday).toISOString(), xp: 50 },
      { createdAt: midWeek(lastMonday).toISOString(), xp: 30 },
      { createdAt: midWeek(twoWeeksAgo).toISOString(), xp: 20 },
    ]);

    expect(result.find((p) => p.week === key(lastMonday))?.xp).toBe(80);
    expect(result.find((p) => p.week === key(twoWeeksAgo))?.xp).toBe(20);
    expect(result.find((p) => p.week === key(thisMonday))?.xp).toBe(0);
  });

  it('skips invalid dates', () => {
    const result = getWeeklyXp([{ createdAt: 'not-a-date', xp: 100 }]);

    expect(result).toHaveLength(12);
    expect(result.every((p) => p.xp === 0)).toBe(true);
  });
});
