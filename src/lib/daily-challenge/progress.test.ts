import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockTransaction = vi.fn();
const mockInsertXpEvent = vi.fn();

vi.mock('../db/client', () => ({
  getDb: () => ({
    select: mockSelect,
    insert: mockInsert,
    update: mockUpdate,
    transaction: mockTransaction,
  }),
  schema: {
    dailyChallenges: {
      id: 'id',
      title: 'title',
      description: 'description',
      goal: 'goal',
      xpReward: 'xpReward',
      type: 'type',
    },
    userChallengeProgress: {
      userId: 'userId',
      date: 'date',
      challengeId: 'challengeId',
      current: 'current',
      completed: 'completed',
    },
  },
}));

vi.mock('../xp/events', () => ({
  insertXpEvent: (...args: any[]) => mockInsertXpEvent(...args),
}));

describe('daily-challenge progress logic', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getActiveChallenge', () => {
    it('returns null if no templates exist', async () => {
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      });

      const { getActiveChallenge } = await import('./progress');
      const challenge = await getActiveChallenge({ select: mockSelect });
      expect(challenge).toBeNull();
    });

    it('returns deterministic challenge template based on UTC day', async () => {
      const templates = [
        { id: 1, title: 'Challenge 1' },
        { id: 2, title: 'Challenge 2' },
      ];
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(templates),
      });

      const { getActiveChallenge } = await import('./progress');
      const challenge = await getActiveChallenge({ select: mockSelect });
      expect(challenge).toBeDefined();
      expect(templates).toContainEqual(challenge);
    });
  });

  describe('incrementChallengeProgress', () => {
    it('skips if active challenge type does not match', async () => {
      // Mock getActiveChallenge to return issue_comment challenge
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([{ id: 1, type: 'issue_comment', goal: 2, xpReward: 50 }]),
      });

      const { incrementChallengeProgress } = await import('./progress');
      const result = await incrementChallengeProgress({
        userId: 'u1',
        type: 'pr_opened', // doesn't match issue_comment
      });

      expect(result).toEqual({ skipped: true, reason: 'no_matching_challenge' });
      expect(mockTransaction).not.toHaveBeenCalled();
    });

    it('increments progress and awards XP if goal is reached', async () => {
      // Mock active challenge
      mockSelect.mockReturnValue({
        from: vi.fn().mockReturnThis(),
        orderBy: vi
          .fn()
          .mockResolvedValue([{ id: 1, type: 'issue_comment', goal: 2, xpReward: 50 }]),
      });

      // Mock tx functions
      const mockTxReturning = vi.fn().mockResolvedValue([{ current: 2, completed: false }]);
      const mockTxWhere = vi.fn().mockResolvedValue({});

      mockTransaction.mockImplementation(async (cb) => {
        return cb({
          insert: () => ({
            values: () => ({
              onConflictDoUpdate: () => ({
                returning: mockTxReturning,
              }),
            }),
          }),
          update: () => ({
            set: () => ({
              where: mockTxWhere,
            }),
          }),
        });
      });

      const { incrementChallengeProgress } = await import('./progress');
      const result = await incrementChallengeProgress({
        userId: 'u1',
        type: 'issue_comment',
      });

      expect(result).toEqual({ ok: true });
      expect(mockTransaction).toHaveBeenCalled();
      expect(mockInsertXpEvent).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          source: 'daily_challenge',
          xpDelta: 50,
        }),
      );
    });
  });
});
