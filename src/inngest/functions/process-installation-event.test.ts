import { describe, it, expect, vi, beforeEach } from 'vitest';
import { processInstallationEvent } from './process-installation-event';
import { sb, wire, step } from './test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));

const mockSend = vi.fn().mockResolvedValue(undefined);
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

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

  it('uninstall sets uninstalled_at', async () => {
    const installs = sb({ update: vi.fn().mockReturnThis() });
    wire({ github_installations: installs });

    await installRun({ event: ev('deleted'), step });

    expect(installs.update).toHaveBeenCalledWith(
      expect.objectContaining({
        uninstalled_at: expect.any(String),
      }),
    );
  });
});
