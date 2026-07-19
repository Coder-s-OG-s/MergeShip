import { describe, it, expect, vi, beforeEach, beforeAll } from 'vitest';

type StepCtx = {
  step: {
    run: (name: string, fn: () => unknown) => unknown;
    sendEvent: (name: string, events: unknown) => unknown;
  };
};
type RawHandler = (ctx: StepCtx) => unknown;

let capturedHandler: RawHandler | null = null;

vi.mock('../client', () => ({
  inngest: {
    createFunction: (_meta: unknown, _trigger: unknown, handler: RawHandler) => {
      capturedHandler = handler;
      return { __isMockedInngestFn: true };
    },
  },
}));

const mockSendEvent = vi.fn();

function runHandler(): Promise<unknown> {
  if (!capturedHandler) throw new Error('Handler not captured');
  return Promise.resolve(
    capturedHandler({
      step: {
        run: (_name: string, fn: () => unknown) => fn(),
        sendEvent: mockSendEvent,
      },
    }),
  );
}

const mockUsersNot = vi.fn();

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: () => ({
    from: (_table: string) => {
      return {
        select: () => ({
          is: () => ({
            not: mockUsersNot,
          }),
        }),
      };
    },
  }),
}));

describe('recommendations-build (dispatcher)', () => {
  beforeAll(async () => {
    await import('./recommendations-build');
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mockUsersNot.mockResolvedValue({ data: [] });
  });

  it('returns zeros when there are no active users', async () => {
    mockUsersNot.mockResolvedValue({ data: [] });

    const result = await runHandler();

    expect(result).toEqual({ activeUsers: 0, batchesDispatched: 0 });
    expect(mockSendEvent).not.toHaveBeenCalled();
  });

  it('batches users and sends worker events', async () => {
    // Generate 120 users
    const mockUsers = Array.from({ length: 120 }, (_, i) => ({ user_id: `user-${i}` }));
    mockUsersNot.mockResolvedValue({ data: mockUsers });

    const result = await runHandler();

    expect(result).toEqual({ activeUsers: 120, batchesDispatched: 3 });
    expect(mockSendEvent).toHaveBeenCalledOnce();

    // First argument is event name, second is array of events
    const [, events] = mockSendEvent.mock.calls[0]!;
    expect(events).toHaveLength(3); // 120 / 50 = 3 batches (50, 50, 20)

    expect(events[0].name).toBe('recommendations/build.worker');
    expect(events[0].data.userIds).toHaveLength(50);
    expect(events[1].data.userIds).toHaveLength(50);
    expect(events[2].data.userIds).toHaveLength(20);
  });
});
