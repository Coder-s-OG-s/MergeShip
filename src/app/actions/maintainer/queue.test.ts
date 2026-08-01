import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getMaintainerIssueQueue, getMaintainerPrQueue } from './queue';

const mocks = vi.hoisted(() => ({
  mockRequireMaintainer: vi.fn(),
  mockListMaintainerRepos: vi.fn(),
  mockCacheGet: vi.fn(),
  mockCacheSet: vi.fn(),
}));

vi.mock('@/lib/action-auth', () => ({
  requireMaintainer: mocks.mockRequireMaintainer,
}));

vi.mock('@/lib/maintainer/detect', () => ({
  listMaintainerRepos: mocks.mockListMaintainerRepos,
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: mocks.mockCacheGet,
  cacheSet: mocks.mockCacheSet,
}));

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}));

vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  RATE_LIMIT_TIERS: {
    GENEROUS: { limit: 1000, windowSec: 60 },
    STANDARD: { limit: 100, windowSec: 60 },
    HOURLY: { limit: 60, windowSec: 3600 },
  },
}));

type Chain = Record<string, unknown>;

function makeService() {
  const queues: Record<string, unknown[]> = new Proxy({} as Record<string, unknown[]>, {
    get(target, prop) {
      if (typeof prop === 'string' && !(prop in target)) target[prop] = [];
      return target[prop as string];
    },
  });
  const chains: Record<string, Chain[]> = {};

  const chain = (q: unknown[]): Chain => {
    const c: Chain = {};
    for (const k of [
      'select',
      'in',
      'eq',
      'or',
      'gte',
      'order',
      'range',
      'is',
      'neq',
      'lte',
      'lt',
      'limit',
      'not',
      'insert',
      'update',
      'delete',
    ]) {
      c[k] = vi.fn(() => c);
    }
    c.maybeSingle = vi.fn(async () => q.shift() ?? { data: null, error: null });
    c.then = (resolve: (v: unknown) => void) => {
      resolve(q.shift() ?? { data: [], count: 0, error: null });
    };
    return c;
  };

  const service = {
    from: vi.fn((table: string) => {
      if (!queues[table]) queues[table] = [];
      if (!chains[table]) chains[table] = [];
      const c = chain(queues[table]);
      chains[table].push(c);
      return c;
    }),
  };

  return { service, queues, chains };
}

function rawPr(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    repo_full_name: 'org/repo',
    number: 1,
    title: 'A PR',
    url: 'https://github.com/org/repo/pull/1',
    state: 'open',
    draft: false,
    author_login: 'author',
    author_user_id: null,
    mentor_verified: false,
    mentor_reviewer_id: null,
    github_updated_at: '2026-01-01T00:00:00.000Z',
    ai_flagged: false,
    ...overrides,
  };
}

function rawIssue(overrides: Record<string, unknown> = {}) {
  return {
    id: 1,
    repo_full_name: 'org/repo',
    github_issue_number: 1,
    title: 'An issue',
    url: 'https://github.com/org/repo/issues/1',
    state: 'open',
    author_login: 'author',
    assignee_login: null,
    labels: [],
    comments_count: 0,
    last_event_at: '2026-07-15T00:00:00.000Z',
    github_created_at: '2026-07-15T00:00:00.000Z',
    ...overrides,
  };
}

describe('getMaintainerPrQueue', () => {
  let queues: Record<string, unknown[]>;
  let chains: Record<string, Chain[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    const svc = makeService();
    queues = svc.queues;
    chains = svc.chains;
    mocks.mockRequireMaintainer.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1' }, service: svc.service },
    });
    mocks.mockListMaintainerRepos.mockResolvedValue(['org/repo']);
  });

  it('returns page 0 and derives hasMore from the exact SQL count', async () => {
    const prs = Array.from({ length: 100 }, (_, i) => rawPr({ id: i + 1, number: i + 1 }));
    queues['installation_settings']!.push({ data: { min_contributor_level: 0 } });
    queues['pull_requests']!.push({ data: prs, count: 500 });

    const res = await getMaintainerPrQueue({ installationId: 1 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows).toHaveLength(25);
      expect(res.data.hasMore).toBe(true);
    }
  });

  it('does not report hasMore once the exact count is exhausted', async () => {
    const prs = Array.from({ length: 30 }, (_, i) => rawPr({ id: i + 1, number: i + 1 }));
    queues['installation_settings']!.push({ data: { min_contributor_level: 0 } });
    queues['pull_requests']!.push({ data: prs, count: 30 });

    const res = await getMaintainerPrQueue({ installationId: 1, page: 1 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows).toHaveLength(5);
      expect(res.data.hasMore).toBe(false);
    }
  });

  it('pushes the min contributor level into SQL via a profiles query', async () => {
    queues['installation_settings']!.push({ data: { min_contributor_level: 2 } });
    queues['profiles']!.push({ data: [{ id: 'p1' }, { id: 'p2' }] });
    queues['profiles']!.push({
      data: [{ id: 'p1', github_handle: 'author', level: 2, xp: 10 }],
    });
    queues['xp_events']!.push({ data: [] });
    queues['pull_requests']!.push({
      data: [rawPr({ id: 7, author_user_id: 'p1' })],
      count: 1,
    });

    const res = await getMaintainerPrQueue({ installationId: 1 });

    expect(res.ok).toBe(true);
    const prChain = chains['pull_requests']![0];
    expect(prChain!.or).toHaveBeenCalledWith('author_user_id.in.(p1,p2)');
    if (res.ok) {
      expect(res.data.rows).toHaveLength(1);
      expect(res.data.rows[0]!.authorLevel).toBe(2);
    }
  });

  it('keeps PRs from authors without a profile when level 0 is allowed', async () => {
    queues['installation_settings']!.push({ data: { min_contributor_level: 0 } });
    queues['profiles']!.push({ data: [{ id: 'p1' }] });
    queues['profiles']!.push({ data: [{ id: 'p1', github_handle: 'a', level: 1, xp: 5 }] });
    queues['xp_events']!.push({ data: [] });
    queues['pull_requests']!.push({
      data: [rawPr({ id: 9, author_user_id: null })],
      count: 1,
    });

    const res = await getMaintainerPrQueue({ installationId: 1, filters: { authorLevel: [0] } });

    expect(res.ok).toBe(true);
    const prChain = chains['pull_requests']![0];
    expect(prChain!.or).toHaveBeenCalledWith('author_user_id.in.(p1),author_user_id.is.null');
    if (res.ok) {
      expect(res.data.rows).toHaveLength(1);
    }
  });

  it('returns an empty queue when no profile clears the author filter', async () => {
    queues['installation_settings']!.push({ data: { min_contributor_level: 3 } });
    queues['profiles']!.push({ data: [] });

    const res = await getMaintainerPrQueue({ installationId: 1 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows).toHaveLength(0);
      expect(res.data.hasMore).toBe(false);
    }
    // No pull_requests read should have been issued.
    expect(chains['pull_requests'] ?? []).toHaveLength(0);
  });

  it('advances the DB window every four pages', async () => {
    queues['installation_settings']!.push({ data: { min_contributor_level: 0 } });
    queues['pull_requests']!.push({
      data: Array.from({ length: 100 }, (_, i) => rawPr({ id: i + 1, number: i + 1 })),
      count: 300,
    });

    const res = await getMaintainerPrQueue({ installationId: 1, page: 4 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.rows).toHaveLength(25);
      expect(res.data.hasMore).toBe(true);
    }
  });
});

describe('getMaintainerIssueQueue', () => {
  let queues: Record<string, unknown[]>;

  beforeEach(() => {
    vi.clearAllMocks();
    const svc = makeService();
    queues = svc.queues;
    mocks.mockRequireMaintainer.mockResolvedValue({
      ok: true,
      data: { user: { id: 'user-1' }, service: svc.service },
    });
    mocks.mockListMaintainerRepos.mockResolvedValue(['org/repo']);
  });

  it('paginates the full candidate set and reports accurate hasMore', async () => {
    queues['issues']!.push({
      data: Array.from({ length: 60 }, (_, i) =>
        rawIssue({ id: i + 1, github_issue_number: i + 1 }),
      ),
    });

    const page0 = await getMaintainerIssueQueue({ installationId: 1, page: 0 });
    expect(page0.ok).toBe(true);
    if (page0.ok) {
      expect(page0.data.rows).toHaveLength(25);
      expect(page0.data.hasMore).toBe(true);
    }

    queues['issues']!.push({
      data: Array.from({ length: 60 }, (_, i) =>
        rawIssue({ id: i + 1, github_issue_number: i + 1 }),
      ),
    });

    const page2 = await getMaintainerIssueQueue({ installationId: 1, page: 2 });
    expect(page2.ok).toBe(true);
    if (page2.ok) {
      expect(page2.data.rows).toHaveLength(10);
      expect(page2.data.hasMore).toBe(false);
    }
  });

  it('classifies issues into buckets and filters by requested buckets', async () => {
    queues['issues']!.push({
      data: [
        rawIssue({ id: 1, assignee_login: null, labels: [] }), // needs-triage
        rawIssue({ id: 2, assignee_login: 'bob', labels: [] }), // in-progress
        rawIssue({
          id: 3,
          assignee_login: null,
          labels: [],
          last_event_at: '2025-01-01T00:00:00.000Z',
          github_created_at: '2025-01-01T00:00:00.000Z',
        }), // stale
        rawIssue({ id: 4, state: 'closed' }), // closed
      ],
    });

    const res = await getMaintainerIssueQueue({
      installationId: 1,
      buckets: ['needs-triage', 'in-progress'],
    });

    expect(res.ok).toBe(true);
    if (res.ok) {
      // needs-triage (1, 3) + in-progress (2); closed (4) excluded.
      expect(res.data.rows).toHaveLength(3);
      const ids = res.data.rows.map((r) => r.id).sort();
      expect(ids).toEqual([1, 2, 3]);
    }
  });
});
