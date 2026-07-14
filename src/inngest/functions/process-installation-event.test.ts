import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  processInstallationEvent,
  processInstallationReposEvent,
} from './process-installation-event';
import { sb, wire, step } from './__tests__/test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));

const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

const reposRun = processInstallationReposEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

// Handler references.
const installRun = processInstallationEvent as unknown as (ctx: {
  event: { data: { payload: Record<string, unknown> } };
  step: typeof step;
}) => Promise<unknown>;

// Factory for an installation webhook event.
const ev = (action: string, extra: Record<string, unknown> = {}) => ({
  data: {
    payload: {
      action,
      installation: {
        id: 100,
        account: { login: 'myorg', type: 'Organization' },
        repository_selection: 'selected',
      },
      repositories: [{ full_name: 'myorg/repo-a' }],
      ...extra,
    },
  },
});

describe('processInstallationEvent', () => {
  beforeEach(() => vi.clearAllMocks());

  it('install event creates github_installations row', async () => {
    const installs = sb({ upsert: vi.fn().mockResolvedValue({ error: null }) });
    wire({
      profiles: sb(),
      github_installations: installs,
      installation_repositories: sb({ upsert: vi.fn().mockResolvedValue({ error: null }) }),
    });

    await installRun({ event: ev('created'), step });

    expect(installs.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        id: 100,
        account_login: 'myorg',
      }),
    );
  });

  describe('uninstall cleanup', () => {
    it('marks uninstalled_at and deletes all 6 derived tables', async () => {
      const installs = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const repos = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const users = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const userRepos = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const settings = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const orgs = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const cursors = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });

      wire({
        github_installations: installs,
        installation_repositories: repos,
        github_installation_users: users,
        installation_user_repos: userRepos,
        installation_settings: settings,
        org_communities: orgs,
        repo_sync_cursors: cursors,
      });

      await installRun({ event: ev('deleted'), step });

      // 1. Uninstall marks uninstalled_at
      expect(installs.update).toHaveBeenCalledWith(
        expect.objectContaining({ uninstalled_at: expect.any(String) }),
      );

      // 2. All 6 derived tables are deleted sequentially
      expect(repos.delete).toHaveBeenCalled();
      expect(users.delete).toHaveBeenCalled();
      expect(userRepos.delete).toHaveBeenCalled();
      expect(settings.delete).toHaveBeenCalled();
      expect(orgs.delete).toHaveBeenCalled();
      expect(cursors.delete).toHaveBeenCalled();
    });

    it('throws if marking uninstalled_at fails', async () => {
      const installs = sb({ eq: vi.fn().mockResolvedValue({ error: { message: 'db error' } }) });
      wire({ github_installations: installs });

      await expect(installRun({ event: ev('deleted'), step })).rejects.toThrow(
        'Failed to mark install 100 as uninstalled: db error',
      );
    });

    it('throws if cleanup deletion fails, leaving remaining tables untouched', async () => {
      const installs = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      // installation_repositories deletes successfully
      const repos = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      // github_installation_users fails
      const users = sb({ eq: vi.fn().mockResolvedValue({ error: { message: 'users error' } }) });
      // remaining tables should not be called
      const userRepos = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });

      wire({
        github_installations: installs,
        installation_repositories: repos,
        github_installation_users: users,
        installation_user_repos: userRepos,
      });

      await expect(installRun({ event: ev('deleted'), step })).rejects.toThrow(
        'Failed to delete from github_installation_users for install 100: users error',
      );

      expect(repos.delete).toHaveBeenCalled();
      expect(users.delete).toHaveBeenCalled();
      expect(userRepos.delete).not.toHaveBeenCalled(); // Failed before reaching this
    });

    it('tolerates already-deleted rows (idempotency)', async () => {
      // Supabase delete() returns { error: null } and 0 rows if nothing matches
      const installs = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      const tables = sb({ eq: vi.fn().mockResolvedValue({ error: null }) });
      wire({
        github_installations: installs,
        installation_repositories: tables,
        github_installation_users: tables,
        installation_user_repos: tables,
        installation_settings: tables,
        org_communities: tables,
        repo_sync_cursors: tables,
      });

      const result = await installRun({ event: ev('deleted'), step });
      expect(result).toEqual({ ok: true, uninstalled: true, cleanup: true });
    });
  });

  it('suspend sets suspended_at', async () => {
    const installs = sb({ update: vi.fn().mockReturnThis() });
    wire({ github_installations: installs });

    await installRun({ event: ev('suspend'), step });

    expect(installs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        suspended_at: expect.any(String),
      }),
    );
  });

  it('unsuspend clears suspended_at', async () => {
    const installs = sb({ update: vi.fn().mockReturnThis() });
    wire({ github_installations: installs });

    await installRun({ event: ev('unsuspend'), step });

    expect(installs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        suspended_at: null,
      }),
    );
  });

  it('transferred updates account_login and triggers maintainer discover', async () => {
    const installs = sb({ update: vi.fn().mockReturnThis() });
    wire({
      github_installations: installs,
      github_installation_users: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ user_id: 'u1', profiles: { github_handle: 'alice' } }],
        }),
      }),
    });

    await installRun({ event: ev('transferred'), step });

    expect(installs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        account_login: 'myorg',
      }),
    );
    expect(mockSend).toHaveBeenCalledWith(
      expect.objectContaining({
        name: 'maintainer/discover',
        data: expect.objectContaining({ userId: 'u1', githubHandle: 'alice', force: true }),
      }),
    );
  });
  it('repositories_added uses upsert to support webhook replays', async () => {
    const repos = sb({
      upsert: vi.fn().mockResolvedValue({ error: null }),
    });

    wire({
      installation_repositories: repos,
    });

    await reposRun({
      event: {
        data: {
          payload: {
            action: 'added',
            installation: { id: 100 },
            repositories_added: [{ full_name: 'myorg/repo-a' }],
          },
        },
      },
      step,
    });

    expect(repos.upsert).toHaveBeenCalled();
  });
});
