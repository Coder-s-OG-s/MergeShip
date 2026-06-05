import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallationToken } from '@/lib/github/app';
import { fetchMergedCount, fetchContributionStreak } from '@/app/actions/github-sync-helpers';
import { cacheDel } from '@/lib/cache';
import { githubStatsSync } from './github-stats-sync';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallationToken: vi.fn() }));
vi.mock('@/app/actions/github-sync-helpers', () => ({
  fetchMergedCount: vi.fn(),
  fetchContributionStreak: vi.fn(),
}));
vi.mock('@/lib/cache', () => ({ cacheDel: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = githubStatsSync as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

const ev = (over: Record<string, unknown> = {}) => ({
  data: { userId: 'u1', githubHandle: 'alice', ...over },
});

describe('githubStatsSync', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('successfully updates stats for active users', async () => {
    const profiles = sb({ update: vi.fn().mockReturnThis() });
    wire({
      github_installations: sb({
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 42 } }),
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [{ id: 42 }] }),
      }),
      profiles,
    });

    vi.mocked(getInstallationToken).mockResolvedValue('fake-token');
    vi.mocked(fetchMergedCount).mockResolvedValue(5);
    vi.mocked(fetchContributionStreak).mockResolvedValue(10);

    const result = await run({ event: ev(), step });

    expect(profiles.update).toHaveBeenCalledWith(
      expect.objectContaining({
        github_total_merges: 5,
        github_streak: 10,
      }),
    );
    expect(cacheDel).toHaveBeenCalledWith('gh:dashboard:u1');
    expect(result).toEqual({ merges: 5, streak: 10 });
  });

  it('throws error if no installation found', async () => {
    wire({
      github_installations: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: [] }),
      }),
    });

    await expect(run({ event: ev(), step })).rejects.toThrow('no GitHub App installation found');
    expect(fetchMergedCount).not.toHaveBeenCalled();
  });
});
