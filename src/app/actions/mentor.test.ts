import { describe, it, expect, vi, beforeEach } from 'vitest';
import { verifyPrAction } from './mentor';
import * as detect from '@/lib/maintainer/detect';
import * as rateLimitLib from '@/lib/rate-limit';
import * as xpEvents from '@/lib/xp/events';

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

vi.mock('@/lib/rate-limit', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/rate-limit')>();
  return { ...actual, rateLimit: vi.fn() };
});

vi.mock('@/lib/xp/events', () => ({
  insertXpEvent: vi.fn(),
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

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

const USER = { id: 'mentor-1' };

describe('verifyPrAction', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ data: { user: USER } });
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({
      ok: true,
      remaining: 10,
      resetAt: 0,
    } as never);
    vi.mocked(detect.isUserMaintainer).mockResolvedValue(true);
    vi.mocked(detect.listMaintainerInstalls).mockResolvedValue([
      {
        installationId: 1,
        accountLogin: 'org',
        accountType: 'Organization',
        permissionLevel: 'org_admin',
      },
    ]);
    vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

    mockFrom.mockImplementation((table) => {
      if (table === 'profiles') {
        return chain({ id: USER.id, level: 2, github_handle: 'mentor' });
      }
      if (table === 'pull_requests') {
        return chain({
          id: 100,
          author_user_id: 'user-2',
          repo_full_name: 'org/repo',
          number: 1,
          mentor_verified: false,
          author_login: 'mentee',
        });
      }
      return chain();
    });
  });

  it('verifies a maintainer can successfully verify a PR in one of their repositories', async () => {
    vi.mocked(xpEvents.insertXpEvent).mockResolvedValue({} as never);

    const res = await verifyPrAction({ prId: 100 });

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.xpAwarded).toBeGreaterThan(0);
    }
  });

  it('verifies a non-maintainer cannot verify a PR outside their scope', async () => {
    vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

    const res = await verifyPrAction({ prId: 100 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('You do not maintain the repository for this PR');
    }
  });

  it('verifies repeated requests trigger the rate limiter', async () => {
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({
      ok: false,
      remaining: 0,
      resetAt: 0,
    } as never);

    const res = await verifyPrAction({ prId: 100 });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.error.message).toBe('slow down');
    }
  });
});
