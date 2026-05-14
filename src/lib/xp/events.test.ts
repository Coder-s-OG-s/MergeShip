import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockReturning = vi.fn();
const mockOnConflictDoNothing = vi.fn(() => ({ returning: mockReturning }));
const mockValues = vi.fn(() => ({ onConflictDoNothing: mockOnConflictDoNothing }));
const mockInsert = vi.fn(() => ({ values: mockValues }));
const mockExecute = vi.fn();

vi.mock('../db/client', () => ({
  getDb: () => ({ insert: mockInsert, execute: mockExecute }),
  schema: { xpEvents: { userId: 'u', source: 's', refId: 'r' } },
}));

beforeEach(() => {
  mockReturning.mockReset();
  mockExecute.mockReset();
  mockInsert.mockClear();
  mockValues.mockClear();
  mockOnConflictDoNothing.mockClear();
});

describe('insertXpEvent', () => {
  it('returns true when a row is inserted', async () => {
    mockReturning.mockResolvedValueOnce([{ id: 1 }]);
    const { insertXpEvent } = await import('./events');
    const inserted = await insertXpEvent({
      userId: 'u1',
      source: 'recommended_merge',
      refId: 'pr:foo/bar:1',
      xpDelta: 150,
      difficulty: 'M',
    });
    expect(inserted).toBe(true);
    expect(mockInsert).toHaveBeenCalled();
    expect(mockValues).toHaveBeenCalledWith(
      expect.objectContaining({ userId: 'u1', refId: 'pr:foo/bar:1', xpDelta: 150 }),
    );
  });

  it('returns false on idempotent duplicate (no row returned)', async () => {
    mockReturning.mockResolvedValueOnce([]);
    const { insertXpEvent } = await import('./events');
    const inserted = await insertXpEvent({
      userId: 'u1',
      source: 'recommended_merge',
      refId: 'pr:foo/bar:1',
      xpDelta: 150,
    });
    expect(inserted).toBe(false);
  });
});

describe('insertXpEvent tripwire', () => {
  it('writes activity_log when daily total crosses threshold', async () => {
    // First execute call = sumXpToday returning 1950 prior to this event.
    // Then onConflictDoNothing returns inserted row.
    // Then second execute call = activity_log insert.
    mockExecute.mockResolvedValueOnce([{ sum: 1950 }]);
    mockReturning.mockResolvedValueOnce([{ id: 7 }]);
    mockExecute.mockResolvedValueOnce({});
    const { insertXpEvent } = await import('./events');
    const inserted = await insertXpEvent({
      userId: 'u-trip',
      source: 'recommended_merge',
      refId: 'pr:foo:99',
      xpDelta: 100, // 1950 + 100 = 2050 → crosses
    });
    expect(inserted).toBe(true);
    // 2 execute calls total: one for sumXpToday, one for activity_log insert.
    expect(mockExecute).toHaveBeenCalledTimes(2);
  });

  it('does not write tripwire when prior total already over threshold', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: 2100 }]); // already over
    mockReturning.mockResolvedValueOnce([{ id: 8 }]);
    const { insertXpEvent } = await import('./events');
    await insertXpEvent({
      userId: 'u-over',
      source: 'recommended_merge',
      refId: 'pr:foo:100',
      xpDelta: 50,
    });
    // Only the sumXpToday execute fired; no activity_log execute.
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('does not write tripwire when total stays under threshold', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: 100 }]);
    mockReturning.mockResolvedValueOnce([{ id: 9 }]);
    const { insertXpEvent } = await import('./events');
    await insertXpEvent({
      userId: 'u-low',
      source: 'comment',
      refId: 'comment:x:1:1',
      xpDelta: 1,
    });
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('does not write tripwire on idempotent duplicate (insert returned no rows)', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: 1950 }]);
    mockReturning.mockResolvedValueOnce([]); // duplicate, no row
    const { insertXpEvent } = await import('./events');
    const inserted = await insertXpEvent({
      userId: 'u-dup',
      source: 'recommended_merge',
      refId: 'pr:foo:99',
      xpDelta: 100,
    });
    expect(inserted).toBe(false);
    expect(mockExecute).toHaveBeenCalledTimes(1);
  });

  it('swallows tripwire write errors silently', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: 1950 }]);
    mockReturning.mockResolvedValueOnce([{ id: 10 }]);
    mockExecute.mockRejectedValueOnce(new Error('activity_log down'));
    const { insertXpEvent } = await import('./events');
    const inserted = await insertXpEvent({
      userId: 'u-err',
      source: 'recommended_merge',
      refId: 'pr:foo:101',
      xpDelta: 100,
    });
    expect(inserted).toBe(true); // tripwire failure doesn't undo the insert
  });
});

describe('sumXp', () => {
  it('sums xp_events for the user', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: 250 }]);
    const { sumXp } = await import('./events');
    expect(await sumXp('u1')).toBe(250);
  });

  it('returns 0 when no rows', async () => {
    mockExecute.mockResolvedValueOnce([{ sum: null }]);
    const { sumXp } = await import('./events');
    expect(await sumXp('u1')).toBe(0);
  });

  it('handles empty result array', async () => {
    mockExecute.mockResolvedValueOnce([]);
    const { sumXp } = await import('./events');
    expect(await sumXp('u1')).toBe(0);
  });
});
