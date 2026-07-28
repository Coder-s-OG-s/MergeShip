import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mocks External API

const mockInsert = vi.fn().mockResolvedValue({ error: null });
const mockFrom = vi.fn().mockReturnValue({ insert: mockInsert });

vi.mock('@/lib/supabase/service', () => ({
  getServiceSupabase: vi.fn(() => ({ from: mockFrom })),
}));

vi.mock('../client', () => ({
  inngest: {
    createFunction: vi.fn((_config: unknown, _trigger: unknown, handler: Function) => handler),
  },
}));

import { deadLetterHandler } from './dead-letter';

// Helpers

function buildEvent(overrides: Record<string, unknown> = {}) {
  return {
    data: {
      function_id: 'process-pr-event',
      error: { message: 'Connection refused', name: 'Error' },
      event: {
        name: 'github/pull_request',
        data: {
          deliveryId: 'abc-123',
          eventType: 'pull_request',
          payload: { action: 'opened' },
        },
      },
      ...overrides,
    },
  };
}

describe('deadLetterHandler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockInsert.mockResolvedValue({ error: null });
  });

  it('persists a dead-letter row for a webhook function', async () => {
    const handler = deadLetterHandler as unknown as (ctx: {
      event: ReturnType<typeof buildEvent>;
    }) => Promise<unknown>;
    const result = await handler({ event: buildEvent() });

    expect(mockFrom).toHaveBeenCalledWith('failed_webhook_events');
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: 'abc-123',
        event_type: 'github/pull_request',
        source: 'inngest/dead-letter',
        error: expect.stringContaining('process-pr-event'),
      }),
    );
    expect(result).toEqual(
      expect.objectContaining({ persisted: true, functionId: 'process-pr-event' }),
    );
  });

  it('skips persistence for non-webhook functions', async () => {
    const handler = deadLetterHandler as unknown as (ctx: {
      event: ReturnType<typeof buildEvent>;
    }) => Promise<unknown>;
    const result = await handler({
      event: buildEvent({ function_id: 'weekly-digest' }),
    });

    expect(mockFrom).not.toHaveBeenCalled();
    expect(result).toEqual(
      expect.objectContaining({ persisted: false, reason: 'not_webhook_function' }),
    );
  });

  it('handles insert errors gracefully', async () => {
    mockInsert.mockResolvedValue({ error: { message: 'disk full' } });
    const handler = deadLetterHandler as unknown as (ctx: {
      event: ReturnType<typeof buildEvent>;
    }) => Promise<unknown>;
    const result = await handler({ event: buildEvent() });

    expect(result).toEqual(expect.objectContaining({ persisted: false, reason: 'insert_failed' }));
  });

  it('uses fallback delivery ID when original event has none', async () => {
    const handler = deadLetterHandler as unknown as (ctx: {
      event: ReturnType<typeof buildEvent>;
    }) => Promise<unknown>;
    await handler({
      event: buildEvent({
        event: { name: 'github/pull_request', data: {} },
      }),
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        delivery_id: expect.stringMatching(/^auto-\d+$/),
      }),
    );
  });
});
