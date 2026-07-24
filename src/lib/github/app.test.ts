import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

/* ------------------------------------------------------------------ */
/* Mock heavy Octokit packages so dynamic imports stay fast.           */
/* ------------------------------------------------------------------ */
const mockRequest = vi.fn().mockResolvedValue({
  data: { token: 'mock_token', expires_at: new Date(Date.now() + 3600000).toISOString() },
});
const mockWrap = vi.fn();
const FakeOctokit = vi.fn().mockImplementation(() => ({
  request: mockRequest,
  hook: { wrap: mockWrap },
}));

vi.mock('@octokit/rest', () => ({ Octokit: FakeOctokit }));
vi.mock('@octokit/auth-app', () => ({ createAppAuth: vi.fn() }));
vi.mock('../cache', () => ({
  cacheGet: vi.fn().mockResolvedValue(null),
  cacheSet: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('./rate-budget', () => ({
  updateRateBudget: vi.fn().mockResolvedValue(undefined),
}));

const KEYS = ['GITHUB_APP_ID', 'GITHUB_APP_PRIVATE_KEY'] as const;

describe('github app factories', () => {
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    vi.resetModules();
    FakeOctokit.mockClear();
    mockRequest.mockClear();
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
  }, 15_000);

  it('getInstallationToken throws when env missing', async () => {
    const { getInstallationToken } = await import('./app');
    await expect(getInstallationToken(123)).rejects.toThrow(/GITHUB_APP_ID/);
  }, 15_000);

  it('getUserOctokit returns a client given a token', async () => {
    const { getUserOctokit } = await import('./app');
    const oc = getUserOctokit('ghp_fake');
    expect(oc).toBeTruthy();
    expect(typeof oc.request).toBe('function');
  }, 15_000);

  it('getInstallOctokit registers a hook that tracks budget', async () => {
    process.env.GITHUB_APP_ID = '123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'secret';

    const { getInstallOctokit } = await import('./app');
    const { updateRateBudget } = await import('./rate-budget');

    const oc = await getInstallOctokit(999);
    expect(mockWrap).toHaveBeenCalledWith('request', expect.any(Function));

    const wrapHandler = mockWrap.mock.calls[0]![1];

    // Simulate a successful request with headers
    const fakeRequest = vi.fn().mockResolvedValue({
      headers: {
        'x-ratelimit-remaining': '4900',
        'x-ratelimit-reset': '1600000000',
      },
    });

    const res = await wrapHandler(fakeRequest, {});
    expect(res.headers).toBeTruthy();
    expect(updateRateBudget).toHaveBeenCalledWith(999, 4900, 1600000000);
  });

  it('getInstallOctokit hook tracks budget on failed requests', async () => {
    process.env.GITHUB_APP_ID = '123';
    process.env.GITHUB_APP_PRIVATE_KEY = 'secret';

    const { getInstallOctokit } = await import('./app');
    const { updateRateBudget } = await import('./rate-budget');

    await getInstallOctokit(999);
    const wrapHandler = mockWrap.mock.calls[0]![1];

    // Simulate a rate limit exceeded error
    const fakeError: any = new Error('Rate limit exceeded');
    fakeError.response = {
      headers: {
        'x-ratelimit-remaining': '0',
        'x-ratelimit-reset': '1600003600',
      },
    };

    const fakeRequest = vi.fn().mockRejectedValue(fakeError);

    await expect(wrapHandler(fakeRequest, {})).rejects.toThrow('Rate limit exceeded');
    expect(updateRateBudget).toHaveBeenCalledWith(999, 0, 1600003600);
  });
});
