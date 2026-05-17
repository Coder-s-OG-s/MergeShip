import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isUserMaintainer, listMaintainerInstalls, listMaintainerRepos } from './detect';
import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/cache';

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(),
}));

vi.mock('@/lib/cache', () => ({
  cacheGet: vi.fn(),
  cacheSet: vi.fn(),
}));

const mockSupabase = (mockTables: Record<string, any>) => {
  const mockClient = {
    _currentTable: '',
    from: vi.fn().mockImplementation((table: string) => {
      mockClient._currentTable = table;
      return mockClient;
    }),
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockImplementation(() => {
      return Promise.resolve({ data: mockTables[mockClient._currentTable] ?? null });
    }),
    then: function (resolve: any) {
      resolve({ data: mockTables[mockClient._currentTable] ?? null });
    },
  };
  return mockClient;
};

describe('isUserMaintainer', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns true when user has an active installation row (uninstalled_at is null)', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [{ github_installations: { uninstalled_at: null } }],
      }) as any,
    );

    const result = await isUserMaintainer('user1');
    expect(result).toBe(true);
    expect(cacheSet).toHaveBeenCalledWith('maint:status:user1', true, 3600);
  });

  it('returns false when all installation rows have uninstalled_at set', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [
          { github_installations: { uninstalled_at: '2023-01-01T00:00:00Z' } },
          { github_installations: { uninstalled_at: '2023-02-01T00:00:00Z' } },
        ],
      }) as any,
    );

    const result = await isUserMaintainer('user1');
    expect(result).toBe(false);
    expect(cacheSet).toHaveBeenCalledWith('maint:status:user1', false, 3600);
  });

  it('returns false when user has no rows in github_installation_users', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [],
      }) as any,
    );

    const result = await isUserMaintainer('user1');
    expect(result).toBe(false);
    expect(cacheSet).toHaveBeenCalledWith('maint:status:user1', false, 3600);
  });

  it('returns false when service client is not configured', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(getServiceSupabase).mockReturnValue(null as any);

    const result = await isUserMaintainer('user1');
    expect(result).toBe(false);
    expect(cacheSet).toHaveBeenCalledWith('maint:status:user1', false, 3600);
  });

  it('returns cached result when cache is warm (should not hit DB)', async () => {
    vi.mocked(cacheGet).mockResolvedValue(true);

    const result = await isUserMaintainer('user1');
    expect(result).toBe(true);
    expect(getServiceSupabase).not.toHaveBeenCalled();
    expect(cacheSet).not.toHaveBeenCalled();
  });

  it('writes result to cache after DB query', async () => {
    vi.mocked(cacheGet).mockResolvedValue(null);
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [],
      }) as any,
    );

    await isUserMaintainer('user1');
    expect(cacheSet).toHaveBeenCalledWith('maint:status:user1', false, 3600);
  });
});

describe('listMaintainerInstalls', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns list of active installs with correct shape', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [
          {
            installation_id: 1,
            permission_level: 'org_admin',
            github_installations: {
              account_login: 'org1',
              account_type: 'Organization',
              uninstalled_at: null,
            },
          },
        ],
      }) as any,
    );

    const result = await listMaintainerInstalls('user1');
    expect(result).toEqual([
      {
        installationId: 1,
        accountLogin: 'org1',
        accountType: 'Organization',
        permissionLevel: 'org_admin',
      },
    ]);
  });

  it('filters out installs where uninstalled_at is not null', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [
          {
            installation_id: 1,
            permission_level: 'org_admin',
            github_installations: {
              account_login: 'org1',
              account_type: 'Organization',
              uninstalled_at: '2023-01-01T00:00:00Z',
            },
          },
          {
            installation_id: 2,
            permission_level: 'repo_admin',
            github_installations: {
              account_login: 'user-org',
              account_type: 'User',
              uninstalled_at: null,
            },
          },
        ],
      }) as any,
    );

    const result = await listMaintainerInstalls('user1');
    expect(result).toEqual([
      {
        installationId: 2,
        accountLogin: 'user-org',
        accountType: 'User',
        permissionLevel: 'repo_admin',
      },
    ]);
  });

  it('returns empty array when user has no installs', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: [],
      }) as any,
    );

    const result = await listMaintainerInstalls('user1');
    expect(result).toEqual([]);
  });
});

describe('listMaintainerRepos', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('returns all repos for org_admin permission level', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: { permission_level: 'org_admin' },
        installation_repositories: [
          { repo_full_name: 'org/repo1' },
          { repo_full_name: 'org/repo2' },
        ],
      }) as any,
    );

    const result = await listMaintainerRepos('user1', 1);
    expect(result).toEqual(['org/repo1', 'org/repo2']);
  });

  it('returns only scoped repos for repo_admin/repo_maintain', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: { permission_level: 'repo_admin' },
        installation_user_repos: [{ repo_full_name: 'org/repo1' }],
      }) as any,
    );

    const result = await listMaintainerRepos('user1', 1);
    expect(result).toEqual(['org/repo1']);
  });

  it('returns empty array when user has no junction row for that installation', async () => {
    vi.mocked(getServiceSupabase).mockReturnValue(
      mockSupabase({
        github_installation_users: null,
      }) as any,
    );

    const result = await listMaintainerRepos('user1', 1);
    expect(result).toEqual([]);
  });
});
