import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  getCommunityLinks,
  upsertCommunityLink,
  deleteCommunityLink,
  getRepoHealthOverview,
  getStaleIssues,
  getTopContributors,
  getFlaggedAccounts,
  getInstallationSettings,
  setMinContributorLevel,
  setAutoAssignMentorChain,
  getRepoPicker,
  setRepoManaged,
  resolveFlaggedAccount,
  getPrCiStatus,
  getReviewerLoad,
} from './maintainer';
import * as detect from '@/lib/maintainer/detect';
import * as rateLimitLib from '@/lib/rate-limit';

//   Supabase mocks

const mockGetUser = vi.fn();
vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockFrom = vi.fn();
vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({ from: mockFrom }),
}));

const mockDbLimit = vi.fn();
const mockDbOrderBy = vi.fn(() => ({
  limit: mockDbLimit,
  then: (resolve: any) => resolve([]),
}));
const mockDbGroupBy = vi.fn(() => ({ orderBy: mockDbOrderBy }));
const mockDbWhere = vi.fn(() => ({ groupBy: mockDbGroupBy }));
const mockDbInnerJoin = vi.fn(() => ({ where: mockDbWhere }));
const mockDbFrom = vi.fn(() => ({ innerJoin: mockDbInnerJoin }));
const mockDbSelect = vi.fn(() => ({ from: mockDbFrom }));

const mockDb = { select: mockDbSelect };

vi.mock('@/lib/db/client', () => ({
  tryGetDb: () => mockDb,
}));

vi.mock('drizzle-orm', () => ({
  eq: vi.fn(),
  inArray: vi.fn(),
  sum: vi.fn(),
  desc: vi.fn(),
  and: vi.fn(),
  count: vi.fn(),
}));

vi.mock('@/lib/maintainer/detect', () => ({
  isUserMaintainer: vi.fn(),
  listMaintainerInstalls: vi.fn(),
  listMaintainerRepos: vi.fn(),
}));

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return {
    ...actual,
    rateLimit: vi.fn(),
  };
});

vi.mock('@/inngest/client', () => ({
  inngest: { send: vi.fn() },
}));

// Chainable Supabase query mock — every method returns self, await resolves to { data, error }
function chain(data: unknown = [], error: unknown = null) {
  const c: Record<string, unknown> = {};
  const pass = () => c;
  c.select = vi.fn(pass);
  c.in = vi.fn(pass);
  c.eq = vi.fn(pass);
  c.order = vi.fn(pass);
  c.range = vi.fn(pass);
  c.not = vi.fn(pass);
  c.update = vi.fn(pass);
  c.delete = vi.fn(pass);
  c.upsert = vi.fn(pass);
  c.single = vi.fn(pass);
  c.maybeSingle = vi.fn(pass);
  c.limit = vi.fn(pass);
  c.then = (resolve: (v: unknown) => void) => resolve({ data, error });
  return c;
}

const USER = { id: 'user-1' };

describe('maintainer actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(detect.isUserMaintainer).mockResolvedValue(true);
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: true } as never);
  });

  //   Auth guards

  describe('auth guards', () => {
    it('returns not_authenticated when no user session', async () => {
      mockGetUser.mockResolvedValue({ data: { user: null } });
      const res = await getMaintainerInstalls();
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authenticated');
    });

    it('returns not_authorised when isUserMaintainer is false', async () => {
      vi.mocked(detect.isUserMaintainer).mockResolvedValue(false);
      const res = await getMaintainerPrQueue({ installationId: 1 });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);
      const res = await getMaintainerPrQueue({ installationId: 1 });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });
  });

  //   getMaintainerInstalls

  describe('getMaintainerInstalls', () => {
    it('returns list of active installations', async () => {
      const installs = [{ installationId: 1, accountLogin: 'org1' }];
      vi.mocked(detect.listMaintainerInstalls).mockResolvedValue(installs as never);
      const res = await getMaintainerInstalls();
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual(installs);
    });

    it('returns empty array when user has no installs', async () => {
      vi.mocked(detect.listMaintainerInstalls).mockResolvedValue([]);
      const res = await getMaintainerInstalls();
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });
  });

  //   installation settings

  describe('installation settings', () => {
    it('returns default min contributor level when no row exists', async () => {
      mockFrom.mockReturnValueOnce(chain({ installation_id: 1 })).mockReturnValueOnce(chain(null));

      const res = await getInstallationSettings(1);

      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.minContributorLevel).toBe(0);
    });

    it('returns saved min contributor level', async () => {
      mockFrom
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain({ min_contributor_level: 2, auto_assign_mentor_chain: true }));

      const res = await getInstallationSettings(1);

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.minContributorLevel).toBe(2);
        expect(res.data.autoAssignMentorChain).toBe(true);
      }
    });

    it('rejects invalid min contributor level', async () => {
      const res = await setMinContributorLevel({ installationId: 1, minContributorLevel: 4 });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_input');
    });

    it('upserts min contributor level for maintainer install', async () => {
      const upsert = chain();
      mockFrom
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain({ auto_assign_mentor_chain: true }))
        .mockReturnValueOnce(upsert);

      const res = await setMinContributorLevel({ installationId: 1, minContributorLevel: 2 });

      expect(res.ok).toBe(true);
      expect(upsert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          installation_id: 1,
          min_contributor_level: 2,
          auto_assign_mentor_chain: true,
        }),
        { onConflict: 'installation_id' },
      );
    });

    it('upserts auto-assign mentor chain while preserving min contributor level', async () => {
      const upsert = chain();
      mockFrom
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain({ min_contributor_level: 2 }))
        .mockReturnValueOnce(upsert);

      const res = await setAutoAssignMentorChain({ installationId: 1, enabled: true });

      expect(res.ok).toBe(true);
      expect(upsert.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          installation_id: 1,
          min_contributor_level: 2,
          auto_assign_mentor_chain: true,
        }),
        { onConflict: 'installation_id' },
      );
    });
  });

  //   getMaintainerPrQueue

  describe('getMaintainerPrQueue', () => {
    const rawPr = {
      id: 1,
      repo_full_name: 'org/repo',
      number: 42,
      title: 'feat: add feature',
      url: 'https://github.com/org/repo/pull/42',
      state: 'open',
      draft: false,
      author_login: 'alice',
      author_user_id: null,
      mentor_verified: false,
      mentor_reviewer_id: null,
      github_updated_at: '2026-05-18T00:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
    });

    it('returns paginated PR rows', async () => {
      mockFrom.mockReturnValue(chain([rawPr]));
      const res = await getMaintainerPrQueue({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.rows).toHaveLength(1);
        expect(res.data.rows[0]?.title).toBe('feat: add feature');
      }
    });

    it('filters by state', async () => {
      const c = chain([rawPr]);
      mockFrom.mockReturnValue(c);
      await getMaintainerPrQueue({ installationId: 1, filters: { state: ['open'] } });
      expect(c.in).toHaveBeenCalledWith('state', ['open']);
    });

    it('filters by mentorVerified=yes', async () => {
      const c = chain([{ ...rawPr, mentor_verified: true }]);
      mockFrom.mockReturnValue(c);
      await getMaintainerPrQueue({ installationId: 1, filters: { mentorVerified: 'yes' } });
      expect(c.eq).toHaveBeenCalledWith('mentor_verified', true);
    });

    it('returns empty when user has no repos for the install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getMaintainerPrQueue({ installationId: 99 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.rows).toEqual([]);
    });

    it('hides PRs below the installation minimum contributor level', async () => {
      const lowPr = {
        ...rawPr,
        id: 1,
        title: 'low trust',
        author_user_id: 'low-user',
      };
      const seniorPr = {
        ...rawPr,
        id: 2,
        title: 'senior trust',
        author_user_id: 'senior-user',
      };

      mockFrom
        .mockReturnValueOnce(chain({ min_contributor_level: 2 }))
        .mockReturnValueOnce(chain([lowPr, seniorPr]))
        .mockReturnValueOnce(
          chain([
            { id: 'low-user', github_handle: 'low', level: 1, xp: 50 },
            { id: 'senior-user', github_handle: 'senior', level: 2, xp: 500 },
          ]),
        )
        .mockReturnValueOnce(chain([]));

      const res = await getMaintainerPrQueue({ installationId: 1 });

      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.rows).toHaveLength(1);
        expect(res.data.rows[0]?.title).toBe('senior trust');
      }
    });

    it('paginates using non-overlapping 100-row blocks', async () => {
      const mockBlock = Array.from({ length: 100 }).map((_, i) => ({
        ...rawPr,
        id: i + 1,
        number: i + 1,
        title: `PR ${i + 1}`,
      }));

      const c = chain(mockBlock);
      mockFrom.mockReturnValue(c);

      const allFetchedIds = new Set<number>();
      let totalRows = 0;

      for (let page = 0; page < 4; page++) {
        const res = await getMaintainerPrQueue({ installationId: 1, page });
        expect(res.ok).toBe(true);
        if (!res.ok) continue;

        expect(c.range).toHaveBeenCalledWith(0, 99);
        expect(res.data.rows).toHaveLength(25);

        for (const row of res.data.rows) {
          expect(allFetchedIds.has(row.id)).toBe(false);
          allFetchedIds.add(row.id);
        }
        totalRows += res.data.rows.length;
      }

      expect(totalRows).toBe(100);
      expect(allFetchedIds.size).toBe(100);

      const cNext = chain([]);
      mockFrom.mockReturnValue(cNext);
      await getMaintainerPrQueue({ installationId: 1, page: 4 });
      expect(cNext.range).toHaveBeenCalledWith(100, 199);
    });
  });

  //   getMaintainerIssueQueue

  describe('getMaintainerIssueQueue', () => {
    const rawIssue = {
      id: 10,
      repo_full_name: 'org/repo',
      github_issue_number: 5,
      title: 'Bug: crash on login',
      url: 'https://github.com/org/repo/issues/5',
      state: 'open' as const,
      author_login: 'bob',
      assignee_login: null,
      labels: [],
      comments_count: 0,
      last_event_at: null,
      github_created_at: '2026-05-18T00:00:00Z',
    };

    beforeEach(() => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
    });

    it('returns issue rows from the queue', async () => {
      mockFrom.mockReturnValue(chain([rawIssue]));
      const res = await getMaintainerIssueQueue({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.rows[0]?.title).toBe('Bug: crash on login');
    });

    it('defaults to open state when no closed bucket', async () => {
      const c = chain([rawIssue]);
      mockFrom.mockReturnValue(c);
      await getMaintainerIssueQueue({ installationId: 1 });
      expect(c.in).toHaveBeenCalledWith('state', ['open']);
    });

    it('includes closed state when closed bucket is requested', async () => {
      const c = chain([]);
      mockFrom.mockReturnValue(c);
      await getMaintainerIssueQueue({ installationId: 1, buckets: ['closed'] });
      expect(c.in).toHaveBeenCalledWith('state', ['open', 'closed']);
    });
  });

  //   getCommunityLinks

  describe('getCommunityLinks', () => {
    it('returns community links for an installation', async () => {
      const row = {
        id: 1,
        installation_id: 1,
        kind: 'discord',
        url: 'https://discord.gg/test',
        label: null,
        updated_at: '2026-05-18T00:00:00Z',
      };
      mockFrom.mockReturnValue(chain([row]));
      const res = await getCommunityLinks(1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        expect(res.data[0]?.kind).toBe('discord');
      }
    });
  });

  //   upsertCommunityLink

  describe('upsertCommunityLink', () => {
    it('creates a new link when junction exists', async () => {
      mockFrom
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain({ id: 99 }));
      const res = await upsertCommunityLink({
        installationId: 1,
        kind: 'discord',
        url: 'https://discord.gg/test',
      });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.id).toBe(99);
    });

    it('returns not_authorised when install does not belong to user', async () => {
      mockFrom.mockReturnValueOnce(chain(null));
      const res = await upsertCommunityLink({
        installationId: 999,
        kind: 'discord',
        url: 'https://discord.gg/test',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns invalid_url for bad URLs', async () => {
      mockFrom.mockReturnValueOnce(chain({ installation_id: 1 }));
      const res = await upsertCommunityLink({
        installationId: 1,
        kind: 'discord',
        url: 'not-a-url',
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('invalid_url');
    });
  });

  //   deleteCommunityLink

  describe('deleteCommunityLink', () => {
    it('deletes the correct row', async () => {
      mockFrom
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain({ installation_id: 1 }))
        .mockReturnValueOnce(chain());
      const res = await deleteCommunityLink(1);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data.ok).toBe(true);
    });

    it('returns not_found when link does not exist', async () => {
      mockFrom.mockReturnValueOnce(chain(null));
      const res = await deleteCommunityLink(999);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_found');
    });
  });

  //   getRepoPicker

  describe('getRepoPicker', () => {
    beforeEach(() => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo', 'org/other']);
    });

    function byTable(tables: Record<string, unknown>) {
      mockFrom.mockImplementation((table: string) => chain(tables[table] ?? []));
    }

    it('returns rows with derived metadata, scoped to managed repos', async () => {
      byTable({
        installation_repositories: [
          { repo_full_name: 'org/repo', managed: true, added_at: '2026-01-01T00:00:00Z' },
          // Not in the caller's maintainer scope → filtered out.
          { repo_full_name: 'org/secret', managed: true, added_at: '2026-01-01T00:00:00Z' },
        ],
        pull_requests: [
          { repo_full_name: 'org/repo', state: 'open', github_updated_at: '2026-05-01T00:00:00Z' },
          { repo_full_name: 'org/repo', state: 'open', github_updated_at: '2026-06-01T00:00:00Z' },
          {
            repo_full_name: 'org/repo',
            state: 'merged',
            github_updated_at: '2026-04-01T00:00:00Z',
          },
        ],
        issues: [{ repo_full_name: 'org/repo', repo_language: 'TypeScript' }],
      });

      const res = await getRepoPicker(1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        const row = res.data[0]!;
        expect(row.repoFullName).toBe('org/repo');
        expect(row.openPrCount).toBe(2);
        expect(row.language).toBe('TypeScript');
        expect(row.lastUpdatedAt).toBe('2026-06-01T00:00:00Z');
        expect(row.managed).toBe(true);
      }
    });

    it('falls back to added_at and null language when no PRs/issues', async () => {
      byTable({
        installation_repositories: [
          { repo_full_name: 'org/repo', managed: false, added_at: '2026-01-01T00:00:00Z' },
        ],
        pull_requests: [],
        issues: [],
      });

      const res = await getRepoPicker(1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        const row = res.data[0]!;
        expect(row.openPrCount).toBe(0);
        expect(row.language).toBeNull();
        expect(row.lastUpdatedAt).toBe('2026-01-01T00:00:00Z');
        expect(row.managed).toBe(false);
      }
    });

    it('returns empty when caller maintains no repos for the install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getRepoPicker(99);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns not_authorised when not a maintainer', async () => {
      vi.mocked(detect.isUserMaintainer).mockResolvedValue(false);
      const res = await getRepoPicker(1);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });
  });

  //   setRepoManaged

  describe('setRepoManaged', () => {
    it('updates managed flag for a repo in scope', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      const c = chain([{ repo_full_name: 'org/repo' }]);
      mockFrom.mockReturnValue(c);
      const res = await setRepoManaged({
        installationId: 1,
        repoFullName: 'org/repo',
        managed: false,
      });
      expect(res.ok).toBe(true);
      expect(c.update).toHaveBeenCalledWith({ managed: false });
    });

    it('returns not_found when the update matches no rows', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockFrom.mockReturnValue(chain([]));
      const res = await setRepoManaged({
        installationId: 1,
        repoFullName: 'org/repo',
        managed: true,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_found');
    });

    it('returns not_authorised for a repo outside the caller scope', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      const res = await setRepoManaged({
        installationId: 1,
        repoFullName: 'org/not-mine',
        managed: true,
      });
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });
  });
  it('getRepoHealthOverview returns rate_limited when rate limit exceeded', async () => {
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

    const res = await getRepoHealthOverview({ installationId: 1 });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('rate_limited');
  });

  it('getStaleIssues returns rate_limited when rate limit exceeded', async () => {
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

    const res = await getStaleIssues({ installationId: 1 });

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('rate_limited');
  });

  //   getTopContributors

  describe('getTopContributors', () => {
    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await getTopContributors({ installationId: 1 });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns empty array if maintainer has no repos in install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getTopContributors({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns empty array if no contributions found in scoped repos', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);
      mockDbLimit.mockResolvedValueOnce([]);
      const res = await getTopContributors({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns scoped contributors matching PR authors', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);

      const mockRows = [
        { githubHandle: 'alice', xp: 100, level: 2 },
        { githubHandle: 'bob', xp: 50, level: 1 },
      ];

      mockDbLimit.mockResolvedValueOnce(mockRows);

      const res = await getTopContributors({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(2);
        expect(res.data[0]?.githubHandle).toBe('alice');
        expect(res.data[1]?.githubHandle).toBe('bob');
      }
    });
  });

  it('getFlaggedAccounts returns rate_limited when rate limit exceeded', async () => {
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

    const res = await getFlaggedAccounts();

    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('rate_limited');
  });

  describe('getFlaggedAccounts scoping', () => {
    beforeEach(() => {
      vi.mocked(detect.listMaintainerInstalls).mockResolvedValue([
        {
          installationId: 1,
          accountLogin: 'org1',
          accountType: 'Organization',
          permissionLevel: 'org_admin',
        },
      ]);
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['my-org/my-repo']);
    });

    it('scopes flagged accounts to users with activity in maintainer repos', async () => {
      const flagged = [
        {
          id: 1,
          user_id: 'user-active-pr',
          reason: 'daily_xp_event_spike',
          severity: 'medium',
          evidence: {
            items: [{ repo: 'my-org/my-repo', xpDelta: 10 }],
          },
          detected_at: '2026-05-18T00:00:00Z',
        },
        {
          id: 2,
          user_id: 'user-active-rec',
          reason: 'rapid_merge_spike',
          severity: 'high',
          evidence: {
            items: [{ repoFullName: 'my-org/my-repo' }],
          },
          detected_at: '2026-05-18T01:00:00Z',
        },
        {
          id: 3,
          user_id: 'user-inactive',
          reason: 'reviewer_approval_concentration',
          severity: 'medium',
          evidence: {
            items: [{ repoFullName: 'some-other/repo' }],
          },
          detected_at: '2026-05-18T02:00:00Z',
        },
      ];

      const prs = [{ author_user_id: 'user-active-pr' }];

      const recs = [{ user_id: 'user-active-rec' }];

      const profiles = [
        { id: 'user-active-pr', github_handle: 'active-pr-user', xp: 100, level: 2 },
        { id: 'user-active-rec', github_handle: 'active-rec-user', xp: 200, level: 3 },
      ];

      mockFrom.mockImplementation((table) => {
        if (table === 'flagged_accounts') return chain(flagged);
        if (table === 'pull_requests') return chain(prs);
        if (table === 'recommendations') return chain(recs);
        if (table === 'profiles') return chain(profiles);
        return chain([]);
      });

      const res = await getFlaggedAccounts({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(2);
        const handles = res.data.map((d) => d.githubHandle);
        expect(handles).toContain('active-pr-user');
        expect(handles).toContain('active-rec-user');
        expect(handles).not.toContain('unknown');
      }
    });

    it('returns empty array when no repos configured for maintainer', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      mockFrom.mockReturnValue(chain([]));

      const res = await getFlaggedAccounts({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(0);
      }
    });
  });

  // resolveFlaggedAccount

  describe('resolveFlaggedAccount', () => {
    it('returns not_authorised when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);
      const res = await resolveFlaggedAccount(1, 'dismissed', 1);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_found if flag does not exist', async () => {
      mockFrom.mockReturnValue(chain(null));
      const res = await resolveFlaggedAccount(1, 'dismissed', 1);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_found');
    });

    it('returns not_authorised if flag evidence has no repos in maintainer scope', async () => {
      mockFrom.mockReturnValue(
        chain({
          id: 1,
          evidence: { items: [{ repoFullName: 'other-org/other-repo' }] },
          user_id: 'user-1',
        }),
      );
      vi.mocked(detect.listMaintainerInstalls).mockResolvedValue([{ installationId: 1 }] as never);
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['my-org/my-repo']);

      const res = await resolveFlaggedAccount(1, 'dismissed', 1);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('updates status when flag is in maintainer scope', async () => {
      const c1 = chain({
        id: 1,
        evidence: { items: [{ repoFullName: 'my-org/my-repo' }] },
        user_id: 'user-1',
      });
      const c2 = chain({ id: 1 });

      mockFrom
        .mockReturnValueOnce(c1) // For select
        .mockReturnValueOnce(c2); // For update

      vi.mocked(detect.listMaintainerInstalls).mockResolvedValue([{ installationId: 1 }] as never);
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['my-org/my-repo']);

      const res = await resolveFlaggedAccount(1, 'dismissed', 1);
      expect(res.ok).toBe(true);
      expect(c2.update).toHaveBeenCalledWith(expect.objectContaining({ status: 'dismissed' }));
    });
  });

  // getPrCiStatus

  describe('getPrCiStatus', () => {
    it('returns not_authorised when install does not belong to user', async () => {
      // mock assertMaintainerInstall failure (no junction row)
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await getPrCiStatus(999, 'org/repo', 1);

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns status when install belongs to user', async () => {
      // mock assertMaintainerInstall success
      mockFrom.mockReturnValueOnce(chain({ installation_id: 1 }));

      // Using demo/repo hits the fallback path without mocking Octokit
      const res = await getPrCiStatus(1, 'demo/repo', 1);

      expect(res.ok).toBe(true);
    });
  });

  // getReviewerLoad

  describe('getReviewerLoad', () => {
    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await getReviewerLoad({ installationId: 1 });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns empty array if maintainer has no repos in install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getReviewerLoad({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns empty array if no reviewer loads found', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);
      mockDbOrderBy.mockReturnValueOnce({
        limit: mockDbLimit,
        then: (resolve: any) => resolve([]),
      });
      const res = await getReviewerLoad({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns reviewer load data', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);

      const mockRows = [
        { reviewerId: 'user-1', githubHandle: 'alice', avatarUrl: 'url1', prCount: 3 },
        { reviewerId: 'user-2', githubHandle: 'bob', avatarUrl: 'url2', prCount: 1 },
      ];

      mockDbOrderBy.mockReturnValueOnce({
        limit: mockDbLimit,
        then: (resolve: any) => resolve(mockRows),
      });

      const res = await getReviewerLoad({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(2);
        expect(res.data[0]?.githubHandle).toBe('alice');
        expect(res.data[0]?.prCount).toBe(3);
        expect(res.data[1]?.githubHandle).toBe('bob');
        expect(res.data[1]?.prCount).toBe(1);
      }
    });
  });
});
