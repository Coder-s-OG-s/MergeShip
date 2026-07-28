import { describe, it, expect, vi, beforeEach, assert } from 'vitest';
import { getFailedWebhookEvents, retryFailedWebhookEvent } from './failed-events';
import { requireMaintainer } from '@/lib/action-auth';
import { listMaintainerRepos } from '@/lib/maintainer/detect';
import { inngest } from '@/inngest/client';

vi.mock('@/lib/action-auth', () => ({
  requireMaintainer: vi.fn(),
}));

vi.mock('@/lib/maintainer/detect', () => ({
  listMaintainerRepos: vi.fn(),
}));

vi.mock('@/inngest/client', () => ({
  inngest: {
    send: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('next/cache', () => ({
  revalidatePath: vi.fn(),
}));

describe('failed-events action', () => {
  const mockService = {
    from: vi.fn(),
    rpc: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(requireMaintainer).mockResolvedValue({
      ok: true,
      data: {
        user: { id: 'user_1' } as any,
        sb: mockService as any,
        service: mockService as any,
      },
    });
  });

  describe('getFailedWebhookEvents', () => {
    it('correctly filters and returns failed pull_request webhook events', async () => {
      vi.mocked(listMaintainerRepos).mockResolvedValue(['myorg/myrepo']);

      const rawEvents = [
        {
          id: 1,
          delivery_id: 'del_1',
          event_type: 'github/pull_request.opened',
          source: 'webhook',
          error: 'timeout',
          retry_count: 0,
          created_at: '2026-07-28T00:00:00Z',
          payload: {
            pull_request: {
              base: {
                repo: {
                  full_name: 'myorg/myrepo',
                },
              },
            },
          },
        },
        {
          id: 2,
          delivery_id: 'del_2',
          event_type: 'github/issues.opened',
          source: 'webhook',
          error: 'error',
          retry_count: 0,
          created_at: '2026-07-28T01:00:00Z',
          payload: {
            repository: {
              full_name: 'other/unmaintained-repo',
            },
          },
        },
      ];

      const chain = {
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        limit: vi.fn().mockResolvedValue({ data: rawEvents, error: null }),
      };
      mockService.from.mockReturnValue(chain);

      const res = await getFailedWebhookEvents({ installationId: 100 });

      expect(res.ok).toBe(true);
      assert(res.ok);
      expect(res.data.count).toBe(1);
      expect(res.data.rows).toHaveLength(1);
      expect(res.data.rows[0]?.id).toBe(1);
    });
  });

  describe('retryFailedWebhookEvent', () => {
    it('allows retrying failed pull_request webhook events', async () => {
      vi.mocked(listMaintainerRepos).mockResolvedValue(['myorg/myrepo']);

      const failedEvent = {
        id: 1,
        event_type: 'github/pull_request.opened',
        retry_count: 1,
        payload: {
          pull_request: {
            base: {
              repo: {
                full_name: 'myorg/myrepo',
              },
            },
          },
        },
      };

      const chain: any = {
        select: vi.fn().mockReturnThis(),
        update: vi.fn().mockReturnThis(),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockImplementation(() => chain),
        maybeSingle: vi.fn().mockResolvedValue({ data: failedEvent }),
      };

      mockService.from.mockReturnValue(chain);
      mockService.rpc.mockResolvedValue({ data: true, error: null });

      const res = await retryFailedWebhookEvent({ eventId: 1, installationId: 100 });

      expect(res.ok).toBe(true);
      expect(inngest.send).toHaveBeenCalledWith({
        name: 'github/pull_request.opened',
        data: failedEvent.payload,
      });
    });
  });
});
