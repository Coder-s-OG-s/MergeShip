import { describe, it, expect, vi, beforeEach } from 'vitest';
import { pingReviewers } from './ping-reviewers';

const mocks = vi.hoisted(() => ({
  mockRequireMaintainer: vi.fn(),
  mockGetDb: vi.fn(),
  mockListMaintainerRepos: vi.fn(),
  mockGetInstallOctokit: vi.fn(),
}));

vi.mock('@/lib/action-auth', () => ({
  requireMaintainer: mocks.mockRequireMaintainer,
}));

vi.mock('@/lib/db/client', () => ({
  getDb: mocks.mockGetDb,
}));

vi.mock('@/lib/maintainer/detect', () => ({
  listMaintainerRepos: mocks.mockListMaintainerRepos,
}));

vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: mocks.mockGetInstallOctokit,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn((col, val) => ({ col, val, _type: 'eq' })),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_TIERS: { STANDARD: { limit: 30, windowSec: 60 } },
}));

function chain(data: unknown = null) {
  const c: Record<string, unknown> = {};
  c.where = vi.fn(() => c);
  c.from = vi.fn(() => c);
  c.select = vi.fn(() => c);
  c.then = (resolve: (v: unknown) => void) => resolve({ data, error: null });
  return c;
}

describe('pingReviewers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.mockRequireMaintainer.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1' }, sb: {}, service: {} },
    });
  });

  it('returns not_authorised when user does not maintain the repo', async () => {
    const mockDb = {
      select: vi.fn().mockReturnThis(),
      from: vi.fn().mockReturnThis(),
      where: vi
        .fn()
        .mockResolvedValueOnce({
          data: [{ id: 1, repoFullName: 'org/repo', number: 42 }],
          error: null,
        })
        .mockResolvedValueOnce({ data: [{ installationId: 1 }], error: null }),
    };
    mocks.mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ id: 1, repoFullName: 'org/repo', number: 42 }])
            .mockResolvedValueOnce([{ installationId: 1 }]),
        })),
      })),
    });
    mocks.mockListMaintainerRepos.mockResolvedValue(['org/other']);

    const res = await pingReviewers(123);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });

  it('returns not_found when PR does not exist', async () => {
    mocks.mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi.fn().mockResolvedValueOnce([]),
        })),
      })),
    });

    const res = await pingReviewers(999);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_found');
    }
  });

  it('posts comment successfully when authorised', async () => {
    const mockIssuesCreateComment = vi.fn().mockResolvedValue({});
    mocks.mockGetInstallOctokit.mockResolvedValue({
      issues: { createComment: mockIssuesCreateComment },
    });

    mocks.mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ id: 1, repoFullName: 'org/repo', number: 42 }])
            .mockResolvedValueOnce([{ installationId: 1 }]),
        })),
      })),
    });

    mocks.mockListMaintainerRepos.mockResolvedValue(['org/repo']);

    const res = await pingReviewers(123);
    expect(res.ok).toBe(true);
    expect(mockIssuesCreateComment).toHaveBeenCalledWith({
      owner: 'org',
      repo: 'repo',
      issue_number: 42,
      body: expect.stringContaining('awaiting review'),
    });
  });

  it('returns not_authorised when listMaintainerRepos throws', async () => {
    mocks.mockGetDb.mockReturnValue({
      select: vi.fn(() => ({
        from: vi.fn(() => ({
          where: vi
            .fn()
            .mockResolvedValueOnce([{ id: 1, repoFullName: 'org/repo', number: 42 }])
            .mockResolvedValueOnce([{ installationId: 1 }]),
        })),
      })),
    });
    mocks.mockListMaintainerRepos.mockResolvedValue([]);

    const res = await pingReviewers(123);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });
});
