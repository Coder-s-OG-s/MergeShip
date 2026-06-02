import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallOctokit } from '@/lib/github/app';
import { buildPrRow, isWithinBackfillWindow } from '@/lib/maintainer/pr-ingest';
import { prBackfill } from './pr-backfill';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallOctokit: vi.fn() }));
vi.mock('@/lib/maintainer/pr-ingest', () => ({
  buildPrRow: vi.fn(),
  isWithinBackfillWindow: vi.fn(),
}));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = prBackfill as unknown as (ctx: {
  event: { name: string; data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

const evRepo = (over: Record<string, unknown> = {}) => ({
  name: 'pr-backfill/repo',
  data: { installationId: 1, repoFullName: 'test-org/repo-1', ...over },
});

describe('prBackfill', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('backfills recent PRs within backfill window', async () => {
    const pull_requests = sb({ upsert: vi.fn().mockResolvedValue({}) });

    wire({
      pull_requests,
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: { id: 'u1' } }),
      }),
    });

    const iterator = (async function* () {
      yield {
        data: [
          {
            id: 101,
            number: 1,
            html_url: 'https://github.com/test-org/repo-1/pull/1',
            title: 'Test PR',
            state: 'open',
            user: { login: 'alice' },
            updated_at: new Date().toISOString(),
          },
        ],
      };
    })();

    const octokit = {
      paginate: { iterator: vi.fn().mockReturnValue(iterator) },
      pulls: {
        list: vi.fn(),
        listReviews: vi.fn().mockResolvedValue({ data: [] }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(isWithinBackfillWindow).mockReturnValue(true);
    vi.mocked(buildPrRow).mockReturnValue({ repo_full_name: 'test-org/repo-1', number: 1 } as any);

    const result = await run({ event: evRepo(), step });

    expect(pull_requests.upsert).toHaveBeenCalledWith(
      { repo_full_name: 'test-org/repo-1', number: 1 },
      { onConflict: 'repo_full_name,number' },
    );
    expect(result).toEqual({ repo: 'test-org/repo-1', prs: 1, errors: [] });
  });

  it('stops pagination when encountering older PRs', async () => {
    wire({
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({ data: null }),
      }),
    });

    const iterator = (async function* () {
      yield {
        data: [
          { id: 102, updated_at: '2020-01-01T00:00:00Z' }, // Outside window
        ],
      };
      // This second page should not be fetched if the loop breaks
      yield {
        data: [{ id: 103, updated_at: '2019-01-01T00:00:00Z' }],
      };
    })();

    const octokit = {
      paginate: { iterator: vi.fn().mockReturnValue(iterator) },
      pulls: { list: vi.fn() },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(isWithinBackfillWindow).mockReturnValue(false); // return false to break loop

    const result = await run({ event: evRepo(), step });

    expect(buildPrRow).not.toHaveBeenCalled();
    expect(result).toEqual({ repo: 'test-org/repo-1', prs: 0, errors: [] });
  });

  it('handles github api errors gracefully', async () => {
    vi.mocked(getInstallOctokit).mockRejectedValue(new Error('API quota exceeded'));

    const result = await run({ event: evRepo(), step });

    expect(result).toEqual({
      repo: 'test-org/repo-1',
      prs: 0,
      errors: ['install-token: API quota exceeded'],
    });
  });
});
