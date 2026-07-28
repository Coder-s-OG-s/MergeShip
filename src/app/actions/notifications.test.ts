import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getUnreadNotificationCount, markAllNotificationsRead } from './notifications';

const mocks = vi.hoisted(() => ({
  mockGetServerSupabase: vi.fn(),
  mockGetUser: vi.fn(),
  mockGetServiceSupabase: vi.fn(),
  mockServiceFrom: vi.fn(),
}));

vi.mock('@/lib/supabase/server', () => ({
  getServerSupabase: mocks.mockGetServerSupabase,
}));

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: mocks.mockGetServiceSupabase,
}));

beforeEach(() => {
  vi.resetAllMocks();
  mocks.mockGetServerSupabase.mockReturnValue({
    auth: { getUser: mocks.mockGetUser },
  });
  mocks.mockGetServiceSupabase.mockReturnValue({
    from: mocks.mockServiceFrom,
  });
});

describe('getUnreadNotificationCount', () => {
  it('returns the unread count for the signed-in user', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ count: 3, error: null }),
    });

    const result = await getUnreadNotificationCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(3);
  });

  it('returns 0 when count is null instead of throwing', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ count: null, error: null }),
    });

    const result = await getUnreadNotificationCount();
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.data).toBe(0);
  });

  it('returns unauthorized when there is no signed-in user', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await getUnreadNotificationCount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('propagates a db_error result when the query fails', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockServiceFrom.mockReturnValue({
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ count: null, error: { message: 'boom' } }),
    });

    const result = await getUnreadNotificationCount();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('db_error');
  });
});

describe('markAllNotificationsRead', () => {
  it('updates read_at for the signed-in user and returns ok', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    const eqMock = vi.fn().mockReturnThis();
    const isMock = vi.fn().mockResolvedValue({ error: null });
    mocks.mockServiceFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: eqMock,
      is: isMock,
    });

    const result = await markAllNotificationsRead();
    expect(result.ok).toBe(true);
    expect(eqMock).toHaveBeenCalledWith('user_id', 'user-1');
    expect(isMock).toHaveBeenCalledWith('read_at', null);
  });

  it('returns unauthorized when there is no signed-in user', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: null }, error: null });

    const result = await markAllNotificationsRead();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('unauthorized');
  });

  it('propagates a db_error result when the update fails', async () => {
    mocks.mockGetUser.mockResolvedValue({ data: { user: { id: 'user-1' } }, error: null });
    mocks.mockServiceFrom.mockReturnValue({
      update: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      is: vi.fn().mockResolvedValue({ error: { message: 'boom' } }),
    });

    const result = await markAllNotificationsRead();
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('db_error');
  });
});
