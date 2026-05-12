import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const KEYS = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'] as const;

describe('github app factories', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    for (const k of KEYS) {
      saved[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of KEYS) {
      if (saved[k] === undefined) delete process.env[k];
      else process.env[k] = saved[k];
    }
  });

  it('getAppOctokit throws when env missing', async () => {
    const { getAppOctokit } = await import('./app');
    expect(() => getAppOctokit()).toThrow(/GITHUB_APP_ID/);
  });

  it('getInstallationToken throws when env missing', async () => {
    const { getInstallationToken } = await import('./app');
    await expect(getInstallationToken(123)).rejects.toThrow(/GITHUB_APP_ID/);
  });

  it('getUserOctokit returns a client given a token', async () => {
    const { getUserOctokit } = await import('./app');
    const oc = getUserOctokit('ghp_fake');
    expect(oc).toBeTruthy();
    expect(typeof oc.request).toBe('function');
  });
});
