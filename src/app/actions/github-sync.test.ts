import { describe, it, expect, vi, beforeEach } from 'vitest';
import { calculateStreak, parsePRState } from './github-sync-helpers';
import { fetchAndBackfillPRs } from './github-sync';

// Mock getInstallationToken
vi.mock('@/lib/github/app', () => ({
  getInstallationToken: vi.fn().mockResolvedValue('mock-token'),
}));

global.fetch = vi.fn() as any;

describe('fetchAndBackfillPRs', () => {
  let mockService: any;

  beforeEach(() => {
    vi.clearAllMocks();
    mockService = {
      from: vi.fn().mockReturnThis(),
      upsert: vi.fn().mockResolvedValue({}),
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      order: vi.fn().mockResolvedValue({
        data: [{ id: 1, title: 'Mock PR' }],
      }),
    };
  });

  it('fetches from github and upserts to db', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [
          {
            id: 123,
            repository_url: 'https://api.github.com/repos/org/repo',
            number: 1,
            title: 'Test PR',
            state: 'open',
            html_url: 'https://github.com/org/repo/pull/1',
            created_at: '2026-05-01T00:00:00Z',
            updated_at: '2026-05-02T00:00:00Z',
          },
        ],
      }),
    });

    const result = await fetchAndBackfillPRs(mockService, 'user-1', 'testuser', 1);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining('q=is:pr+author:testuser'),
      expect.objectContaining({
        headers: expect.objectContaining({
          Authorization: 'Bearer mock-token',
        }),
      }),
    );

    expect(mockService.from).toHaveBeenCalledWith('pull_requests');
    expect(mockService.upsert).toHaveBeenCalledWith(
      [
        expect.objectContaining({
          github_pr_id: 123,
          repo_full_name: 'org/repo',
          title: 'Test PR',
          state: 'open',
        }),
      ],
      { onConflict: 'github_pr_id', ignoreDuplicates: false },
    );

    expect(result).toEqual([{ id: 1, title: 'Mock PR' }]);
  });

  it('proceeds without auth token if installId is null', async () => {
    (global.fetch as any).mockResolvedValue({
      ok: true,
      json: async () => ({
        items: [],
      }),
    });

    await fetchAndBackfillPRs(mockService, 'user-1', 'testuser', null);

    expect(global.fetch).toHaveBeenCalledWith(
      expect.any(String),
      expect.not.objectContaining({
        headers: expect.objectContaining({ Authorization: 'Bearer mock-token' }),
      }),
    );
  });

  it('returns empty array if fetch fails', async () => {
    (global.fetch as any).mockRejectedValue(new Error('Network error'));

    const result = await fetchAndBackfillPRs(mockService, 'user-1', 'testuser', 1);
    expect(result).toEqual([]);
    expect(mockService.upsert).not.toHaveBeenCalled();
  });
});

describe('calculateStreak', () => {
  const day = (date: string, count: number) => ({ date, contributionCount: count });

  it('returns 0 when no contributions', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const days = [
      day('2026-05-14', 3),
      day('2026-05-13', 1),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(3);
  });

  it('skips today if zero contributions (streak from yesterday)', () => {
    const days = [
      day('2026-05-14', 0),
      day('2026-05-13', 5),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(2);
  });

  it('returns 0 when yesterday is also zero', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0), day('2026-05-12', 5)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('handles single day with contributions', () => {
    const days = [day('2026-05-14', 1)];
    expect(calculateStreak(days, '2026-05-14')).toBe(1);
  });
});

describe('parsePRState', () => {
  it('returns merged when merged_at is set', () => {
    expect(parsePRState('closed', '2026-05-01T00:00:00Z')).toBe('merged');
  });

  it('returns open when state is open and not merged', () => {
    expect(parsePRState('open', null)).toBe('open');
  });

  it('returns closed when state is closed and not merged', () => {
    expect(parsePRState('closed', null)).toBe('closed');
  });
});
