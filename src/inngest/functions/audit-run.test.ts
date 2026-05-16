import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallOctokit, getUserOctokit } from '@/lib/github/app';
import { insertXpEvent } from '@/lib/xp/events';
import { computeAuditScore } from '@/lib/xp/audit';
import { clampAuditScoreToLevel } from '@/lib/xp/audit-clamp';
import { pickPrimaryLanguage } from '@/lib/xp/primary-language';
import { auditRun } from './audit-run';
import { sb, wire, step } from './test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallOctokit: vi.fn(), getUserOctokit: vi.fn() }));
vi.mock('@/lib/xp/events', () => ({ insertXpEvent: vi.fn() }));
vi.mock('@/lib/xp/audit', () => ({ computeAuditScore: vi.fn() }));
vi.mock('@/lib/xp/audit-clamp', () => ({ clampAuditScoreToLevel: vi.fn() }));
vi.mock('@/lib/xp/primary-language', () => ({ pickPrimaryLanguage: vi.fn() }));
vi.mock('@/lib/xp/sources', () => ({
  XP_SOURCE: { GITHUB_AUDIT: 'github_audit' },
  refIds: { audit: (id: string) => `audit:${id}` },
}));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

// Handler reference.
const run = auditRun as unknown as (ctx: {
  event: { data: Record<string, unknown> };
  step: typeof step;
}) => Promise<unknown>;

// Factory for an audit event payload.
const ev = (over: Record<string, unknown> = {}) => ({
  data: { userId: 'u1', githubHandle: 'alice', githubId: 'gh-1', ...over },
});

// Canned Octokit with deterministic GitHub API responses.
const gh = () => ({
  users: {
    getByUsername: vi
      .fn()
      .mockResolvedValue({ data: { created_at: '2020-01-01T00:00:00Z', followers: 42 } }),
  },
  search: { issuesAndPullRequests: vi.fn().mockResolvedValue({ data: { total_count: 10 } }) },
  repos: {
    listForUser: vi
      .fn()
      .mockResolvedValue({
        data: [{ language: 'TypeScript' }, { language: 'Python' }, { language: null }],
      }),
  },
});

// Wire all mocks for a successful audit path.
const happy = () => {
  const profiles = sb({
    maybeSingle: vi.fn().mockResolvedValue({ data: { audit_completed: false } }),
    update: vi.fn().mockReturnThis(),
  });
  wire({ profiles });
  vi.mocked(getInstallOctokit).mockResolvedValue(gh() as never);
  vi.mocked(computeAuditScore).mockReturnValue(500);
  vi.mocked(clampAuditScoreToLevel).mockReturnValue(400);
  vi.mocked(pickPrimaryLanguage).mockReturnValue('TypeScript');
  vi.mocked(insertXpEvent).mockResolvedValue(true as never);
  return profiles;
};

describe('auditRun', () => {
  beforeEach(() => vi.clearAllMocks());

  it('leaves normal score alone when below max level', async () => {
    happy();
    vi.mocked(computeAuditScore).mockReturnValue(150); // A "normal" low score
    vi.mocked(clampAuditScoreToLevel).mockReturnValue(150);

    const result = await run({ event: ev({ installationId: 1 }), step });

    expect(insertXpEvent).toHaveBeenCalledWith(expect.objectContaining({ xpDelta: 150 }));
    expect(result).toEqual(expect.objectContaining({ rawAuditScore: 150, auditScore: 150 }));
  });

  it('clamps high score to max level', async () => {
    happy();
    vi.mocked(computeAuditScore).mockReturnValue(2000); // A "high-delta" suspicious score
    vi.mocked(clampAuditScoreToLevel).mockReturnValue(800); // Clamped to L2 max

    const result = await run({ event: ev({ installationId: 1 }), step });

    expect(insertXpEvent).toHaveBeenCalledWith(expect.objectContaining({ xpDelta: 800 }));
    expect(result).toEqual(expect.objectContaining({ rawAuditScore: 2000, auditScore: 800 }));
  });
});
