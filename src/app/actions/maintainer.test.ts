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
  closePullRequest,
  requestChanges,
  mergePullRequest,
  getPrActivityTimeline,
  getPrDetails,
  getNoiseBreakdown,
  getPromotionEligible,
  getContributorsList,
  previewMergeXp,
  getContributorStats,
} from './maintainer';
import * as detect from '@/lib/maintainer/detect';
import * as rateLimitLib from '@/lib/rate-limit';

//   Supabase mocks

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
}));

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

const mockPullsUpdate = vi.fn();
const mockPullsCreateReview = vi.fn();
const mockPullsMerge = vi.fn();
const mockPullsGet = vi.fn();
const mockIssuesListComments = vi.fn();
const mockPullsListReviews = vi.fn();
const mockPullsListCommits = vi.fn();

vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: vi.fn(() => ({
    pulls: {
      update: mockPullsUpdate,
      createReview: mockPullsCreateReview,
      merge: mockPullsMerge,
      get: mockPullsGet,
      listReviews: mockPullsListReviews,
      listCommits: mockPullsListCommits,
    },
    issues: {
      listComments: mockIssuesListComments,
    },
  })),
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

  // getPromotionEligible

  describe('getPromotionEligible', () => {
    beforeEach(() => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await getPromotionEligible({ installationId: 1 });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns empty array if maintainer has no repos in install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns empty array if no XP events found for the repos', async () => {
      // First query: xp_events → empty
      mockFrom.mockReturnValueOnce(chain([]));
      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns contributors within 10% of next level', async () => {
      // L1→L2: gap=459-100=359, floor(35.9)=35, trigger=459-35=424
      // alice: level=1, xp=430 >= 424 ✓ (xpNeeded=459-430=29)
      // bob:   level=1, xp=400 < 424 ✗ (xpNeeded=59 > 35)
      // L2→L3: gap=1119-459=660, floor(66)=66, trigger=1119-66=1053
      // carol: level=2, xp=1100 >= 1053 ✓ (xpNeeded=1119-1100=19)
      mockFrom
        .mockReturnValueOnce(
          chain([{ user_id: 'user-alice' }, { user_id: 'user-bob' }, { user_id: 'user-carol' }]),
        )
        .mockReturnValueOnce(
          chain([
            { github_handle: 'alice', xp: 430, level: 1 },
            { github_handle: 'bob', xp: 400, level: 1 },
            { github_handle: 'carol', xp: 1100, level: 2 },
          ]),
        );

      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(2);
        // Sorted ASC by xpNeeded: carol(19) first, alice(29) second
        expect(res.data[0]?.githubHandle).toBe('carol');
        expect(res.data[0]?.xpNeeded).toBe(19);
        expect(res.data[1]?.githubHandle).toBe('alice');
        expect(res.data[1]?.xpNeeded).toBe(29);
        expect(res.data[1]?.level).toBe(1);
      }
    });

    it('excludes contributors already at max level', async () => {
      // MAX_LEVEL = 5; these contributors should be excluded
      mockFrom
        .mockReturnValueOnce(chain([{ user_id: 'user-max' }]))
        .mockReturnValueOnce(chain([{ github_handle: 'maxlevel', xp: 3404, level: 5 }]));

      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('sorts results by xpNeeded ascending (closest to promotion first)', async () => {
      // L1→L2: gap=359, floor(35.9)=35, trigger=424
      // charlie: level=1, xp=450, xpNeeded=9
      // alice:   level=1, xp=430, xpNeeded=29
      mockFrom
        .mockReturnValueOnce(chain([{ user_id: 'user-alice' }, { user_id: 'user-charlie' }]))
        .mockReturnValueOnce(
          chain([
            { github_handle: 'alice', xp: 430, level: 1 },
            { github_handle: 'charlie', xp: 450, level: 1 },
          ]),
        );

      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data[0]?.githubHandle).toBe('charlie');
        expect(res.data[1]?.githubHandle).toBe('alice');
      }
    });

    it('returns at most 10 results', async () => {
      // Create 12 eligible users all at level=1 with xp=430 (trigger=424, xpNeeded=29)
      const eventRows = Array.from({ length: 12 }, (_, i) => ({ user_id: `user-${i}` }));
      const profileRows = Array.from({ length: 12 }, (_, i) => ({
        github_handle: `user${i}`,
        xp: 430,
        level: 1,
      }));

      mockFrom.mockReturnValueOnce(chain(eventRows)).mockReturnValueOnce(chain(profileRows));

      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toHaveLength(10);
    });

    it('excludes contributors whose stored level is stale (xpNeeded would be negative)', async () => {
      // L1 contributor with xp=500 already exceeds L2 threshold (459) — stale level
      mockFrom
        .mockReturnValueOnce(chain([{ user_id: 'u1' }]))
        .mockReturnValueOnce(chain([{ github_handle: 'stale', xp: 500, level: 1 }]));
      const res = await getPromotionEligible({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
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

  // closePullRequest

  describe('closePullRequest', () => {
    beforeEach(() => {
      mockPullsUpdate.mockClear();
    });

    it('returns not_found when PR does not exist in DB', async () => {
      // Mock PR query returning null
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await closePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns not_found when installation is not found for repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr)) // for pull_requests query
        .mockReturnValueOnce(chain(null)); // for installation_repositories query

      const res = await closePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('Installation not found for this repository');
      }
    });

    it('returns not_authorised when user does not maintain repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr)) // for pull_requests query
        .mockReturnValueOnce(chain(mockRepo)); // for installation_repositories query

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await closePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_authorised');
      }
    });

    it('returns github_error when pulls.update fails', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsUpdate.mockRejectedValueOnce(new Error('GitHub error'));

      const res = await closePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('github_error');
      }
    });

    it('updates state to closed in DB on success', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      const updateChain = chain({ id: 123 });
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo))
        .mockReturnValueOnce(updateChain);

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsUpdate.mockResolvedValueOnce({});

      const res = await closePullRequest(123);
      expect(res.ok).toBe(true);
      expect(mockPullsUpdate).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        state: 'closed',
      });
      expect(updateChain.update).toHaveBeenCalledWith({ state: 'closed' });
    });
  });

  // requestChanges

  describe('requestChanges', () => {
    beforeEach(() => {
      mockPullsCreateReview.mockClear();
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_found when PR does not exist in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns not_found when installation not found for repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(null));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('Installation not found for this repository');
      }
    });

    it('returns not_authorised when repo not in maintainer scope', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns invalid_input when comment is empty or whitespace', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      const res = await requestChanges(123, '   ');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_input');
        expect(res.error.message).toBe('Comment is required');
      }
    });

    it('returns github_error when GitHub API throws', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsCreateReview.mockRejectedValueOnce(new Error('GitHub error'));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('github_error');
    });

    it('returns ok and calls createReview on success', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsCreateReview.mockResolvedValueOnce({});

      const res = await requestChanges(123, 'Please address these issues');
      expect(res.ok).toBe(true);
      expect(mockPullsCreateReview).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        event: 'REQUEST_CHANGES',
        body: 'Please address these issues',
      });
    });
  });

  // mergePullRequest

  describe('mergePullRequest', () => {
    beforeEach(() => {
      mockPullsMerge.mockClear();
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_found when PR does not exist in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns invalid_input when PR is not open', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'closed' };
      mockFrom.mockReturnValueOnce(chain(mockPr));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_input');
        expect(res.error.message).toBe('PR is not open');
      }
    });

    it('returns not_found when installation not found for repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(null));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('Installation not found for this repository');
      }
    });

    it('returns not_authorised when repo not in maintainer scope', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns github_error when GitHub API throws', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsMerge.mockRejectedValueOnce(new Error('GitHub error'));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('github_error');
    });

    it('returns ok, calls merge with squash, and updates DB state to merged', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      const updateChain = chain({ id: 123 });
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo))
        .mockReturnValueOnce(updateChain);
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsMerge.mockResolvedValueOnce({});

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(true);
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'squash',
      });
      expect(updateChain.update).toHaveBeenCalledWith({ state: 'merged' });
    });
  });

  // getNoiseBreakdown

  describe('getNoiseBreakdown', () => {
    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await getNoiseBreakdown({ installationId: 1 });

      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns all zeros if maintainer has no repos in install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getNoiseBreakdown({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({ valid: 0, spamAi: 0, other: 0, total: 0 });
      }
    });

    it('correctly aggregates PRs into valid, spamAi, and other categories', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo1']);

      const mockRows = [
        { aiFlagged: true, state: 'open', cnt: 3 }, // spamAi
        { aiFlagged: true, state: 'closed', cnt: 2 }, // spamAi
        { aiFlagged: false, state: 'closed', cnt: 5 }, // other
        { aiFlagged: false, state: 'open', cnt: 10 }, // valid
        { aiFlagged: false, state: 'merged', cnt: 4 }, // valid
      ];

      // Custom query builder chain mapping the Drizzle API called in getNoiseBreakdown
      const query = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        groupBy: vi.fn().mockReturnThis(),
        then: vi.fn((resolve) => resolve(mockRows)),
      };
      mockDbSelect.mockReturnValueOnce(query);

      const res = await getNoiseBreakdown({ installationId: 1 });
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({
          spamAi: 5, // 3 + 2
          other: 5, // 5
          valid: 14, // 10 + 4
          total: 24,
        });
      }
    });
  });

  // getPrActivityTimeline

  describe('getPrActivityTimeline', () => {
    beforeEach(() => {
      mockPullsGet.mockClear();
      mockIssuesListComments.mockClear();
      mockPullsListReviews.mockClear();
      mockPullsListCommits.mockClear();
    });

    it('returns not_found when PR is not in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await getPrActivityTimeline(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns fallback mock data for demo repos', async () => {
      const mockPr = { repo_full_name: 'demo/repo', number: 42, author_login: 'contributor' };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['demo/repo']);

      const res = await getPrActivityTimeline(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(4);
        expect(res.data[0]?.type).toBe('opened');
        expect(res.data[1]?.type).toBe('commit');
        expect(res.data[2]?.type).toBe('comment');
        expect(res.data[3]?.type).toBe('review');
      }
    });

    it('returns sorted live data on success', async () => {
      const originalAppId = process.env.GITHUB_APP_ID;
      process.env.GITHUB_APP_ID = '123456';
      try {
        const mockPr = { repo_full_name: 'org/repo', number: 42, author_login: 'alice' };
        const mockRepo = { installation_id: 1 };
        mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));

        vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

        // Setup Octokit mock responses
        mockPullsGet.mockResolvedValueOnce({
          data: {
            created_at: '2026-06-30T10:00:00Z',
            user: { login: 'alice', avatar_url: 'url-alice' },
          },
        });

        mockIssuesListComments.mockResolvedValueOnce({
          data: [
            {
              id: 101,
              created_at: '2026-06-30T10:15:00Z',
              user: { login: 'bob', avatar_url: 'url-bob' },
              body: 'My comment',
            },
          ],
        });

        mockPullsListReviews.mockResolvedValueOnce({
          data: [
            {
              id: 201,
              submitted_at: '2026-06-30T10:30:00Z',
              state: 'APPROVED',
              user: { login: 'charlie', avatar_url: 'url-charlie' },
              body: 'Approved!',
            },
          ],
        });

        mockPullsListCommits.mockResolvedValueOnce({
          data: [
            {
              sha: 'commit-sha-123',
              commit: {
                committer: { date: '2026-06-30T10:10:00Z' },
                message: 'My commit message',
              },
              author: { login: 'alice', avatar_url: 'url-alice' },
            },
          ],
        });

        const res = await getPrActivityTimeline(123);
        expect(res.ok).toBe(true);
        if (res.ok) {
          expect(res.data).toHaveLength(4);
          // Order should be chronological: opened (10:00) -> commit (10:10) -> comment (10:15) -> review (10:30)
          expect(res.data[0]?.type).toBe('opened');
          expect(res.data[1]?.type).toBe('commit');
          expect(res.data[1]?.details.message).toBe('My commit message');
          expect(res.data[2]?.type).toBe('comment');
          expect(res.data[2]?.details.body).toBe('My comment');
          expect(res.data[3]?.type).toBe('review');
          expect(res.data[3]?.details.state).toBe('approved');
        }
      } finally {
        process.env.GITHUB_APP_ID = originalAppId;
      }
    });
  });

  // getPrDetails

  describe('getPrDetails', () => {
    it('returns not_found when PR is not in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await getPrDetails(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns not_authorised when user does not maintain repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, author_user_id: 'user-123' };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await getPrDetails(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_authorised');
      }
    });

    it('returns PR details on success', async () => {
      const mockPr = {
        id: 123,
        repo_full_name: 'org/repo',
        number: 42,
        title: 'Awesome PR',
        url: 'https://github.com/org/repo/pull/42',
        state: 'open',
        draft: false,
        author_login: 'alice',
        author_user_id: 'user-123',
        mentor_verified: false,
        mentor_reviewer_id: 'user-456',
        github_updated_at: '2026-06-30T10:00:00Z',
        ai_flagged: true,
      };
      const mockRepo = { installation_id: 1 };
      const mockAuthorProfile = { level: 2, xp: 500 };
      const mockMergedEvents = [{ id: 1 }, { id: 2 }, { id: 3 }];
      const mockMentorProfile = { github_handle: 'mentor-bob', level: 5 };

      mockFrom
        .mockReturnValueOnce(chain(mockPr)) // pull_requests
        .mockReturnValueOnce(chain(mockRepo)) // installation_repositories
        .mockReturnValueOnce(chain(mockAuthorProfile)) // profiles author
        .mockReturnValueOnce(chain(mockMergedEvents)) // xp_events author
        .mockReturnValueOnce(chain(mockMentorProfile)) // profiles mentor
        .mockReturnValueOnce(chain([])); // pull_request_pipeline_stages

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      const res = await getPrDetails(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.id).toBe(123);
        expect(res.data.title).toBe('Awesome PR');
        expect(res.data.authorLevel).toBe(2);
        expect(res.data.authorXp).toBe(500);
        expect(res.data.authorMergedPrs).toBe(3);
        expect(res.data.mentorReviewerHandle).toBe('mentor-bob');
        expect(res.data.mentorReviewerLevel).toBe(5);
        expect(res.data.aiFlagged).toBe(true);
      }
    });
  });

  // getContributorsList

  describe('getContributorsList', () => {
    it('returns empty array when user maintains no repos for the install', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getContributorsList(99);
      expect(res.ok).toBe(true);
      if (res.ok) expect(res.data).toEqual([]);
    });

    it('returns contributor list with correct trust score and AI-flagged PR count', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      const mockPrAgg = [
        {
          author_user_id: 'user-alice',
          state: 'merged',
          mentor_verified: true,
          ai_flagged: false,
          count: 5,
        },
        {
          author_user_id: 'user-alice',
          state: 'open',
          mentor_verified: false,
          ai_flagged: true,
          count: 1,
        },
      ];

      const mockRepoAgg = [{ author_user_id: 'user-alice', repo_full_name: 'org/repo' }];

      const mockProfiles = [
        { id: 'user-alice', github_handle: 'alice', level: 1, xp: 100, github_streak: 6 },
      ];

      const mockLastActive = [{ user_id: 'user-alice', last_active: '2026-07-02T10:00:00Z' }];

      const mockSolved = [{ user_id: 'user-alice', count: 2 }];

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') {
          if (mockFrom.mock.calls.filter((c) => c[0] === 'pull_requests').length === 1) {
            return chain(mockPrAgg);
          }
          return chain(mockRepoAgg);
        }
        if (table === 'profiles') return chain(mockProfiles);
        if (table === 'xp_events') {
          if (mockFrom.mock.calls.filter((c) => c[0] === 'xp_events').length === 1) {
            return chain(mockLastActive);
          }
          return chain(mockSolved);
        }
        return chain([]);
      });

      const res = await getContributorsList(1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toHaveLength(1);
        const alice = res.data[0]!;
        expect(alice.handle).toBe('alice');
        expect(alice.mergedPrs).toBe(5);
        expect(alice.inReview).toBe(1);
        expect(alice.issuesSolved).toBe(2);
        expect(alice.aiFlaggedPrCount).toBe(1);
        // Level 1 (15) + 5 PRs (15) + 2 issues (4) + 6 streak (2) - 1 AI PR (20) = 16
        expect(alice.trustScore).toBe(16);
      }
    });
  });

  // getContributorStats

  describe('getContributorStats', () => {
    it('returns empty stats when no contributors exist', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
      const res = await getContributorStats(99);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data).toEqual({
          total: 0,
          active: 0,
          l2Plus: 0,
          joinedLast7d: 0,
          avgTrust: 0,
          pendingInvites: 0,
        });
      }
    });

    it('calculates correct metrics for contributors', async () => {
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      const mockPrAgg = [
        {
          author_user_id: 'user-alice',
          state: 'merged',
          mentor_verified: true,
          ai_flagged: false,
          count: 5,
        },
        {
          author_user_id: 'user-bob',
          state: 'merged',
          mentor_verified: true,
          ai_flagged: false,
          count: 2,
        },
      ];

      const mockRepoAgg = [
        { author_user_id: 'user-alice', repo_full_name: 'org/repo' },
        { author_user_id: 'user-bob', repo_full_name: 'org/repo' },
      ];

      const mockProfiles = [
        { id: 'user-alice', github_handle: 'alice', level: 2, xp: 100, github_streak: 6 },
        { id: 'user-bob', github_handle: 'bob', level: 1, xp: 50, github_streak: 0 },
      ];

      const now = new Date();
      const twoDaysAgo = new Date(now.getTime() - 2 * 24 * 60 * 60 * 1000).toISOString();
      const fiveDaysAgo = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000).toISOString();
      const fortyDaysAgo = new Date(now.getTime() - 40 * 24 * 60 * 60 * 1000).toISOString();
      const fortyFiveDaysAgo = new Date(now.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString();

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') {
          if (mockFrom.mock.calls.filter((c) => c[0] === 'pull_requests').length === 1) {
            return chain(mockPrAgg);
          }
          return chain(mockRepoAgg);
        }
        if (table === 'profiles') return chain(mockProfiles);
        if (table === 'xp_events') {
          const calls = mockFrom.mock.calls.filter((c) => c[0] === 'xp_events');
          if (calls.length === 1) {
            return chain([
              { user_id: 'user-alice', last_active: twoDaysAgo },
              { user_id: 'user-bob', last_active: fortyDaysAgo },
            ]);
          }
          if (calls.length === 2) {
            return chain([
              { user_id: 'user-alice', first_active: fiveDaysAgo },
              { user_id: 'user-bob', first_active: fortyFiveDaysAgo },
            ]);
          }
          return chain([]);
        }
        return chain([]);
      });

      const res = await getContributorStats(1);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.total).toBe(2);
        expect(res.data.active).toBe(1);
        expect(res.data.l2Plus).toBe(1);
        expect(res.data.joinedLast7d).toBe(1);
        expect(res.data.avgTrust).toBeGreaterThan(0);
        expect(res.data.pendingInvites).toBe(0);
      }
    });
  });

  // previewMergeXp

  describe('previewMergeXp', () => {
    it('returns not_found when PR is not in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns not_authorised when user does not maintain repo', async () => {
      const mockPr = {
        repo_full_name: 'org/repo',
        number: 42,
        author_login: 'alice',
        url: 'pr-url',
      };
      const mockRepo = { installation_id: 1 };
      mockFrom.mockReturnValueOnce(chain(mockPr)).mockReturnValueOnce(chain(mockRepo));

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_authorised');
      }
    });

    it('calculates prospective XP correctly on success with open help request', async () => {
      const mockPr = {
        id: 123,
        repo_full_name: 'org/repo',
        number: 42,
        title: 'Closes #456',
        url: 'https://github.com/org/repo/pull/42',
        state: 'open',
        author_login: 'alice',
        author_user_id: 'user-alice',
        body_excerpt: 'Fixing the bug',
      };
      const mockRepo = { installation_id: 1 };
      const mockRec = { id: 1, user_id: 'user-alice', difficulty: 'M', xp_reward: 150 };
      const mockHelpReq = { id: 10, created_at: '2026-06-30T10:00:00Z', status: 'open' };
      const mockReviews = [
        {
          reviewer_user_id: 'user-bob',
          reviewer_login: 'bob',
          is_mentor: true,
          submitted_at: '2026-06-30T10:30:00Z',
        },
        {
          reviewer_user_id: 'user-charlie',
          reviewer_login: 'charlie',
          is_mentor: false,
          submitted_at: '2026-06-30T15:00:00Z',
        },
      ];

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') return chain(mockPr);
        if (table === 'installation_repositories') return chain(mockRepo);
        if (table === 'recommendations') return chain(mockRec);
        if (table === 'help_requests') return chain(mockHelpReq);
        if (table === 'pull_request_reviews') return chain(mockReviews);
        return chain(null);
      });

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.author.login).toBe('alice');
        expect(res.data.author.xp).toBe(150);
        expect(res.data.author.status).toBe('recommended');

        // Only bob (earliest responder) should receive XP
        expect(res.data.reviewers).toHaveLength(1);
        const bob = res.data.reviewers.find((r) => r.login === 'bob')!;
        expect(bob.xp).toBe(65);
        expect(bob.isMentor).toBe(true);
      }
    });

    it('calculates 0 XP for self merge', async () => {
      const mockPr = {
        id: 123,
        repo_full_name: 'alice/repo',
        number: 42,
        title: 'My PR',
        url: 'https://github.com/alice/repo/pull/42',
        state: 'open',
        author_login: 'alice',
        author_user_id: 'user-alice',
        body_excerpt: '',
      };
      const mockRepo = { installation_id: 1 };

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['alice/repo']);

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') return chain(mockPr);
        if (table === 'installation_repositories') return chain(mockRepo);
        if (table === 'recommendations') return chain(null);
        if (table === 'help_requests') return chain(null);
        if (table === 'pull_request_reviews') return chain([]);
        return chain(null);
      });

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.author.xp).toBe(0);
        expect(res.data.author.status).toBe('self_merge');
      }
    });
    it('returns empty reviewers list when help request is absent', async () => {
      const mockPr = {
        id: 123,
        repo_full_name: 'org/repo',
        number: 42,
        title: 'Fix',
        url: 'https://github.com/org/repo/pull/42',
        state: 'open',
        author_login: 'alice',
        author_user_id: 'user-alice',
        body_excerpt: '',
      };
      const mockRepo = { installation_id: 1 };
      const mockReviews = [
        {
          reviewer_user_id: 'user-bob',
          reviewer_login: 'bob',
          is_mentor: true,
          submitted_at: '2026-06-30T10:30:00Z',
        },
      ];

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') return chain(mockPr);
        if (table === 'installation_repositories') return chain(mockRepo);
        if (table === 'recommendations') return chain(null);
        if (table === 'help_requests') return chain(null);
        if (table === 'pull_request_reviews') return chain(mockReviews);
        return chain(null);
      });

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        expect(res.data.reviewers).toHaveLength(0);
      }
    });

    it('calculates prospective XP correctly on success with resolved help request', async () => {
      const mockPr = {
        id: 123,
        repo_full_name: 'org/repo',
        number: 42,
        title: 'Closes #456',
        url: 'https://github.com/org/repo/pull/42',
        state: 'open',
        author_login: 'alice',
        author_user_id: 'user-alice',
        body_excerpt: 'Fixing the bug',
      };
      const mockRepo = { installation_id: 1 };
      const mockRec = { id: 1, user_id: 'user-alice', difficulty: 'M', xp_reward: 150 };
      const mockHelpReq = {
        id: 10,
        created_at: '2026-06-30T10:00:00Z',
        status: 'resolved',
        resolved_by: 'user-charlie',
        resolved_at: '2026-06-30T15:00:00Z',
      };
      const mockReviews = [
        {
          reviewer_user_id: 'user-bob',
          reviewer_login: 'bob',
          is_mentor: true,
          submitted_at: '2026-06-30T10:30:00Z',
        },
        {
          reviewer_user_id: 'user-charlie',
          reviewer_login: 'charlie',
          is_mentor: false,
          submitted_at: '2026-06-30T15:00:00Z',
        },
      ];

      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      mockFrom.mockImplementation((table) => {
        if (table === 'pull_requests') return chain(mockPr);
        if (table === 'installation_repositories') return chain(mockRepo);
        if (table === 'recommendations') return chain(mockRec);
        if (table === 'help_requests') return chain(mockHelpReq);
        if (table === 'pull_request_reviews') return chain(mockReviews);
        return chain(null);
      });

      const res = await previewMergeXp(123);
      expect(res.ok).toBe(true);
      if (res.ok) {
        // Only charlie (who resolved it) should receive XP
        expect(res.data.reviewers).toHaveLength(1);
        const charlie = res.data.reviewers.find((r) => r.login === 'charlie')!;
        expect(charlie.xp).toBe(30);
        expect(charlie.isMentor).toBe(false);
      }
    });
  });
});
