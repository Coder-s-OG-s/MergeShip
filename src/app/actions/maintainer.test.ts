import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  getCommunityLinks,
  upsertCommunityLink,
  deleteCommunityLink,
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

vi.mock('@/lib/maintainer/detect', () => ({
  isUserMaintainer: vi.fn(),
  listMaintainerInstalls: vi.fn(),
  listMaintainerRepos: vi.fn(),
}));

vi.mock('@/lib/rate-limit', () => ({
  rateLimit: vi.fn(),
}));

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
  c.delete = vi.fn(pass);
  c.upsert = vi.fn(pass);
  c.single = vi.fn(pass);
  c.maybeSingle = vi.fn(pass);
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
});
