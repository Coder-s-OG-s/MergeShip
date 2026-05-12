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
