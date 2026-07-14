import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallOctokit } from '@/lib/github/app';
import { decideOrgGrant, reconcileGrants } from '@/lib/maintainer/discover';
import { cacheGet } from '@/lib/cache';
import { maintainerDiscover } from './maintainer-discover';
import { sb, wire } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallOctokit: vi.fn() }));
vi.mock('@/lib/maintainer/discover', () => ({
  decideOrgGrant: vi.fn(),
  decideRepoGrant: vi.fn(),
  reconcileGrants: vi.fn(),
}));
vi.mock('@/lib/cache', () => ({ cacheGet: vi.fn(), cacheSet: vi.fn() }));

const mockSend = vi.fn();
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

const run = maintainerDiscover as unknown as (ctx: {
  event: { data?: Record<string, unknown> };
  step: any;
}) => Promise<unknown>;

const ev = (over: Record<string, unknown> = {}) => ({
  data: { userId: 'u1', githubHandle: 'alice', force: true, ...over },
});

describe('maintainerDiscover', () => {
  let step: any;
  beforeEach(() => {
    vi.clearAllMocks();
    step = {
      run: vi.fn().mockImplementation(async (_name, cb) => cb()),
      sleepUntil: vi.fn().mockResolvedValue(undefined),
    };
  });

  it('inserts new access grants when a user gains repo access', async () => {
    const installUsers = sb({ upsert: vi.fn().mockResolvedValue({}) });
    const userRepos = sb({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockReturnThis(),
      insert: vi.fn().mockResolvedValue({}),
    });

    wire({
      github_installations: sb({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ id: 1, account_type: 'Organization', account_login: 'test-org' }],
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ repo_full_name: 'test-org/repo-1' }],
        }),
      }),
      github_installation_users: installUsers,
      installation_user_repos: userRepos,
    });

    const octokit = {
      orgs: {
        getMembershipForUser: vi.fn().mockResolvedValue({
          data: { role: 'admin', state: 'active' },
        }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideOrgGrant).mockReturnValue('org_admin');
    vi.mocked(reconcileGrants).mockReturnValue({
      toUpsert: [{ installationId: 1, permissionLevel: 'org_admin', source: 'membership_check' }],
      toDelete: [],
    });
    vi.mocked(cacheGet).mockResolvedValue(null);

    const result = await run({ event: ev(), step });

    expect(octokit.orgs.getMembershipForUser).toHaveBeenCalledWith({
      org: 'test-org',
      username: 'alice',
    });
    expect(installUsers.upsert).toHaveBeenCalledWith(
      expect.arrayContaining([
        expect.objectContaining({
          installation_id: 1,
          user_id: 'u1',
          permission_level: 'org_admin',
        }),
      ]),
      { onConflict: 'installation_id,user_id' },
    );
    expect(result).toEqual(
      expect.objectContaining({
        user: 'u1',
        installs: 1,
        toUpsert: 1,
        toDelete: 0,
      }),
    );
  });

  it('removes access grants when API shows user lost access', async () => {
    const installUsers = sb({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({}),
    });
    const userRepos = sb({
      delete: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      in: vi.fn().mockResolvedValue({}),
    });

    wire({
      github_installations: sb({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockResolvedValue({
          data: [{ id: 1, account_type: 'Organization', account_login: 'test-org' }],
        }),
      }),
      github_installation_users: installUsers,
      installation_user_repos: userRepos,
    });

    const octokit = {
      orgs: {
        getMembershipForUser: vi.fn().mockRejectedValue(new Error('404')),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(decideOrgGrant).mockReturnValue(null);
    vi.mocked(reconcileGrants).mockReturnValue({
      toUpsert: [],
      toDelete: [1],
    });

    const result = await run({ event: ev(), step });

    expect(installUsers.delete).toHaveBeenCalled();
    expect(installUsers.in).toHaveBeenCalledWith('installation_id', [1]);
    expect(userRepos.delete).toHaveBeenCalled();
    expect(userRepos.in).toHaveBeenCalledWith('installation_id', [1]);

    expect(result).toEqual(
      expect.objectContaining({
        user: 'u1',
        installs: 1,
        toUpsert: 0,
        toDelete: 1,
      }),
    );
  });

  it('runs sweep on empty event', async () => {
    wire({
      github_installation_users: sb({
        select: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({
          data: [{ user_id: 'u1' }],
        }),
      }),
      profiles: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        maybeSingle: vi.fn().mockResolvedValue({
          data: { github_handle: 'alice' },
        }),
      }),
    });

    const result = await run({ event: {}, step });

    expect(mockSend).toHaveBeenCalledWith({
      name: 'maintainer/discover',
      data: { userId: 'u1', githubHandle: 'alice', force: true },
    });
    expect(result).toEqual({ swept: 1 });
  });
});
