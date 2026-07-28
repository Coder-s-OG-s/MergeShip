import { describe, it, expect, beforeEach, vi } from 'vitest';
import { checkRateBudget, updateRateBudget, GITHUB_API_BUDGET_THRESHOLD } from './rate-budget';
import { __setMemoryCache } from '../cache';

describe('GitHub Rate Limit Budget Manager', () => {
  beforeEach(() => {
    __setMemoryCache();
    vi.unstubAllEnvs();
  });

  it('allows requests when budget is unknown', async () => {
    const installId = 1001;
    const res = await checkRateBudget(installId);
    expect(res).toEqual({ ok: true, resetAt: 0, remaining: null });
  });

  it('allows requests when budget is available and above threshold', async () => {
    const installId = 1002;
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const remaining = GITHUB_API_BUDGET_THRESHOLD + 100;

    await updateRateBudget(installId, remaining, resetAt);

    const res = await checkRateBudget(installId);
    expect(res).toEqual({ ok: true, resetAt, remaining });
  });

  it('blocks requests when budget is depleted below threshold', async () => {
    const installId = 1003;
    const resetAt = Math.floor(Date.now() / 1000) + 3600;
    const remaining = GITHUB_API_BUDGET_THRESHOLD - 1;

    await updateRateBudget(installId, remaining, resetAt);

    const res = await checkRateBudget(installId);
    expect(res).toEqual({ ok: false, resetAt, remaining });
  });

  it('scopes budget caches per installation', async () => {
    const resetAt = Math.floor(Date.now() / 1000) + 3600;

    await updateRateBudget(1004, GITHUB_API_BUDGET_THRESHOLD + 100, resetAt);
    await updateRateBudget(1005, GITHUB_API_BUDGET_THRESHOLD - 10, resetAt);

    const res1 = await checkRateBudget(1004);
    expect(res1.ok).toBe(true);

    const res2 = await checkRateBudget(1005);
    expect(res2.ok).toBe(false);
  });
});
