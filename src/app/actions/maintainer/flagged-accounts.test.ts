import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getFlaggedAccounts, resolveFlaggedAccount } from './flagged-accounts';

type DbError = { message: string };
type QueryResult = { data: unknown; error: DbError | null };

// Minimal stand-in for the Supabase query builder. Every intermediate call
// returns the chain itself; the terminal call resolves with the configured
// result, mirroring how the real client is awaited in the action code.
type SupabaseChain = {
  select: (...args: unknown[]) => SupabaseChain;
  eq: (...args: unknown[]) => SupabaseChain;
  or: (...args: unknown[]) => SupabaseChain;
  in: (...args: unknown[]) => SupabaseChain;
  order: (...args: unknown[]) => SupabaseChain;
  limit: (...args: unknown[]) => Promise<QueryResult>;
  single: (...args: unknown[]) => Promise<QueryResult>;
  update: (...args: unknown[]) => SupabaseChain;
  then: (resolve: (value: unknown) => void) => void;
};

function makeChain(result: QueryResult, updateResult?: QueryResult): SupabaseChain {
  const chain: SupabaseChain = {
    select: () => chain,
    eq: () => chain,
    or: () => chain,
    in: () => chain,
    order: () => chain,
    limit: () => Promise.resolve(result),
    single: () => Promise.resolve(result),
    update: () => makeChain(updateResult ?? { data: null, error: null }),
    then: (resolve: (value: unknown) => void) => {
      resolve(result);
    },
  };
  return chain;
}

type TableConfig = { select: QueryResult; update?: QueryResult };

const mocks = vi.hoisted(() => ({
  mockRequireMaintainer: vi.fn(),
  mockListMaintainerInstalls: vi.fn(),
  mockListMaintainerRepos: vi.fn(),
  mockLogMaintainerAction: vi.fn(),
  mockRevalidatePath: vi.fn(),
  mockServiceFrom: vi.fn(),
}));

vi.mock('@/lib/action-auth', () => ({
  requireMaintainer: mocks.mockRequireMaintainer,
}));

vi.mock('@/lib/maintainer/detect', () => ({
  listMaintainerInstalls: mocks.mockListMaintainerInstalls,
  listMaintainerRepos: mocks.mockListMaintainerRepos,
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_TIERS: { STANDARD: { limit: 30, windowSec: 60 } },
}));

vi.mock('./audit', () => ({
  logMaintainerAction: mocks.mockLogMaintainerAction,
}));

vi.mock('next/cache', () => ({
  revalidatePath: mocks.mockRevalidatePath,
}));

let tableResponses: Record<string, TableConfig> = {};

const okResult = (data: unknown): QueryResult => ({ data, error: null });
const failedResult = (message: string): QueryResult => ({ data: null, error: { message } });

function mockHappyPath() {
  tableResponses = {
    pull_requests: { select: okResult([{ author_user_id: 'user-a' }, { author_user_id: null }]) },
    recommendations: { select: okResult([{ user_id: 'user-b' }]) },
    flagged_accounts: {
      select: okResult([
        {
          id: 1,
          user_id: 'user-a',
          installation_id: 7,
          reason: 'daily_xp_event_spike',
          severity: 'high',
          detected_at: '2026-09-30T00:00:00Z',
          evidence: {
            items: [
              { repo: 'org/repo', xpDelta: 40 },
              { repo: 'org/repo', xpDelta: 10 },
              { repo: 'org/other', xpDelta: 5 },
            ],
          },
        },
        {
          id: 2,
          user_id: 'user-b',
          installation_id: null,
          reason: 'rapid_merge_spike',
          severity: 'low',
          detected_at: '2026-09-29T00:00:00Z',
          evidence: { items: [{ repoFullName: 'org/repo' }] },
        },
        {
          id: 3,
          user_id: 'user-c',
          installation_id: 7,
          reason: 'reviewer_approval_concentration',
          severity: 'high',
          detected_at: '2026-09-28T00:00:00Z',
          evidence: { items: [{ repo: 'org/unrelated' }] },
        },
      ]),
    },
    profiles: {
      select: okResult([
        { id: 'user-a', github_handle: 'alice', xp: 120, level: 2 },
        { id: 'user-b', github_handle: null, xp: null, level: null },
      ]),
    },
  };
}

describe('getFlaggedAccounts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {};
    mocks.mockRequireMaintainer.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1' }, service: { from: mocks.mockServiceFrom } },
    });
    mocks.mockListMaintainerInstalls.mockResolvedValue([{ installationId: 7 }]);
    mocks.mockListMaintainerRepos.mockResolvedValue(['org/repo']);
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      const cfg = tableResponses[table] ?? { select: okResult([]) };
      return makeChain(cfg.select, cfg.update);
    });
  });

  it('propagates the auth failure when the caller is not a maintainer', async () => {
    mocks.mockRequireMaintainer.mockResolvedValueOnce({
      ok: false,
      error: { code: 'not_authorised', message: 'not a maintainer', retryable: false },
    });

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });

  it('returns an empty list when the maintainer has no installations', async () => {
    mocks.mockListMaintainerInstalls.mockResolvedValue([]);

    const res = await getFlaggedAccounts();

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });

  it('returns an empty list when the maintainer has no repos on the installation', async () => {
    mocks.mockListMaintainerRepos.mockResolvedValue([]);

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });

  it('returns an empty list when no users were active in the maintainer repos', async () => {
    tableResponses = {
      pull_requests: { select: okResult([]) },
      recommendations: { select: okResult([]) },
    };

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });

  it('returns query_failed when the flagged-accounts query errors', async () => {
    tableResponses = {
      pull_requests: { select: okResult([{ author_user_id: 'user-a' }]) },
      recommendations: { select: okResult([]) },
      flagged_accounts: { select: failedResult('db exploded') },
    };

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('query_failed');
    }
  });

  it('returns query_failed when the profile lookup errors', async () => {
    tableResponses = {
      pull_requests: { select: okResult([{ author_user_id: 'user-a' }]) },
      recommendations: { select: okResult([]) },
      flagged_accounts: {
        select: okResult([
          {
            id: 1,
            user_id: 'user-a',
            installation_id: 7,
            reason: 'daily_xp_event_spike',
            severity: 'high',
            detected_at: '2026-09-30T00:00:00Z',
            evidence: { items: [{ repo: 'org/repo', xpDelta: 5 }] },
          },
        ]),
      },
      profiles: { select: failedResult('profiles down') },
    };

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('query_failed');
    }
  });

  it('maps flags to rows, filters evidence to maintainer repos, and defaults unknown severity to medium', async () => {
    mockHappyPath();

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.data).toHaveLength(2);

    const [spike, merge] = res.data;
    if (!spike || !merge) throw new Error('expected two flagged rows');

    // Evidence items on repos the maintainer does not manage are dropped
    // from the count and the XP total, so this row sees 2 items, not 3.
    expect(spike.id).toBe(1);
    expect(spike.githubHandle).toBe('alice');
    expect(spike.xp).toBe(120);
    expect(spike.level).toBe(2);
    expect(spike.severity).toBe('high');
    expect(spike.count).toBe(2);
    expect(spike.summary).toBe('2 XP events in one UTC day (50 XP total).');

    // A severity the UI does not know about is demoted to medium.
    expect(merge.id).toBe(2);
    expect(merge.githubHandle).toBe('unknown');
    expect(merge.xp).toBe(0);
    expect(merge.level).toBe(0);
    expect(merge.severity).toBe('medium');
    expect(merge.count).toBe(1);
    expect(merge.summary).toBe('1 merged PR landed inside one hour.');
  });

  it('drops flags whose evidence references no maintainer repo', async () => {
    mockHappyPath();
    tableResponses.flagged_accounts = {
      select: okResult([
        {
          id: 9,
          user_id: 'user-a',
          installation_id: 7,
          reason: 'rapid_merge_spike',
          severity: 'high',
          detected_at: '2026-09-30T00:00:00Z',
          evidence: { items: [{ repo: 'org/unrelated' }] },
        },
      ]),
    };
    tableResponses.profiles = { select: okResult([]) };

    const res = await getFlaggedAccounts({ installationId: 7 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toEqual([]);
    }
  });
});

describe('resolveFlaggedAccount', () => {
  const successFlag = {
    id: 42,
    evidence: { items: [{ repo: 'org/repo' }] },
    user_id: 'user-a',
    installation_id: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    tableResponses = {};
    mocks.mockRequireMaintainer.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1' }, service: { from: mocks.mockServiceFrom } },
    });
    mocks.mockListMaintainerRepos.mockResolvedValue(['org/repo']);
    mocks.mockLogMaintainerAction.mockResolvedValue(undefined);
    mocks.mockServiceFrom.mockImplementation((table: string) => {
      const cfg = tableResponses[table] ?? { select: okResult(null) };
      return makeChain(cfg.select, cfg.update);
    });
  });

  function mockFlagLookup(flag: unknown) {
    tableResponses = {
      flagged_accounts: { select: okResult(flag) },
    };
  }

  it('returns not_found when the flag does not exist', async () => {
    tableResponses = { flagged_accounts: { select: failedResult('no rows') } };

    const res = await resolveFlaggedAccount(404, 'dismissed', 7);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_found');
    }
  });

  it('returns not_authorised when the flag belongs to a different installation', async () => {
    mockFlagLookup({ ...successFlag, installation_id: 99 });

    const res = await resolveFlaggedAccount(42, 'dismissed', 7);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });

  it('returns not_authorised when the flag has no evidence items', async () => {
    mockFlagLookup({ ...successFlag, evidence: { items: [] } });

    const res = await resolveFlaggedAccount(42, 'dismissed', 7);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });

  it('returns not_authorised when evidence covers a repo the maintainer does not manage', async () => {
    mockFlagLookup({ ...successFlag, evidence: { items: [{ repo: 'org/other' }] } });

    const res = await resolveFlaggedAccount(42, 'dismissed', 7);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('not_authorised');
    }
  });

  it('resolves the flag, logs the action, and revalidates the maintainer page', async () => {
    mockFlagLookup(successFlag);

    const res = await resolveFlaggedAccount(42, 'reviewed', 7);

    expect(res.ok).toBe(true);
    expect(mocks.mockLogMaintainerAction).toHaveBeenCalledWith(
      expect.objectContaining({
        action: 'resolve_flagged_account',
        targetType: 'flagged_account',
        targetId: '42',
        status: 'success',
        newValues: { status: 'reviewed' },
      }),
    );
    expect(mocks.mockRevalidatePath).toHaveBeenCalledWith('/maintainer');
  });

  it('returns persist_failed and logs a failed action when the update errors', async () => {
    tableResponses = {
      flagged_accounts: {
        select: okResult(successFlag),
        update: failedResult('update exploded'),
      },
    };

    const res = await resolveFlaggedAccount(42, 'reviewed', 7);

    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.code).toBe('persist_failed');
    }
    expect(mocks.mockLogMaintainerAction).toHaveBeenCalledWith(
      expect.objectContaining({ status: 'failed' }),
    );
  });
});
