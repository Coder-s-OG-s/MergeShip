import { describe, it, expect, vi, beforeEach } from 'vitest';
import { isSubstantive, processReviewEvent } from './process-review-event';
import { insertXpEvent } from '@/lib/xp/events';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/xp/events', () => ({ insertXpEvent: vi.fn() }));
vi.mock('@/lib/daily-challenge/progress', () => ({
  incrementChallengeProgress: vi.fn().mockResolvedValue({ ok: true }),
}));

vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

const run = processReviewEvent as unknown as (ctx: {
  event: { data: { payload: any } };
  step: typeof step;
}) => Promise<any>;

const ev = (over: any = {}) => ({
  data: {
    payload: {
      action: 'submitted',
      review: {
        id: 1,
        user: { login: 'reviewer-user' },
        body: 'This is a substantive comment that exceeds twenty characters.',
        state: 'approved',
        submitted_at: '2026-05-12T02:00:00Z',
      },
      pull_request: {
        html_url: 'https://github.com/org/repo/pull/42',
        number: 42,
        user: { login: 'author-user' },
        base: { repo: { full_name: 'org/repo' } },
      },
      ...over,
    },
  },
});

const r = (
  over: Partial<Parameters<typeof isSubstantive>[0]> = {},
): Parameters<typeof isSubstantive>[0] => ({
  id: 1,
  user: { login: 'u' },
  body: '',
  state: 'commented',
  submitted_at: '2026-05-12T00:00:00Z',
  ...over,
});

describe('isSubstantive', () => {
  it('changes_requested is always substantive', () => {
    expect(isSubstantive(r({ state: 'changes_requested', body: null }))).toBe(true);
  });

  it('lgtm-only body fails', () => {
    expect(isSubstantive(r({ body: 'lgtm' }))).toBe(false);
    expect(isSubstantive(r({ body: 'LGTM' }))).toBe(false);
    expect(isSubstantive(r({ body: 'looks good to me' }))).toBe(false);
  });

  it('very short body fails', () => {
    expect(isSubstantive(r({ body: 'nice' }))).toBe(false);
  });

  it('null/empty body fails', () => {
    expect(isSubstantive(r({ body: null }))).toBe(false);
    expect(isSubstantive(r({ body: '' }))).toBe(false);
  });

  it('substantive comment passes', () => {
    expect(
      isSubstantive(
        r({
          body: 'I think we should also handle the empty-array edge case here, otherwise the reducer panics.',
        }),
      ),
    ).toBe(true);
  });
});

describe('processReviewEvent handler tests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('aborts when help request is already resolved by another concurrent review', async () => {
    const profilesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } }) // challenge progress check
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } }) // reviewer lookup
        .mockResolvedValueOnce({ data: { level: 1 } }), // mentee lookup
    });

    const helpRequestsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'hr-1', user_id: 'mentee-1', created_at: '2026-05-12T00:00:00Z' },
      }),
      update: vi.fn().mockReturnThis(),
    });

    helpRequestsMock.select = vi
      .fn()
      .mockImplementationOnce(() => helpRequestsMock)
      .mockResolvedValueOnce({ data: [], error: null });

    wire({
      profiles: profilesMock,
      help_requests: helpRequestsMock,
    });

    const result = await run({ event: ev(), step });

    expect(result).toEqual({ xpAwarded: 0, reason: 'help_request_already_resolved' });
    expect(insertXpEvent).not.toHaveBeenCalled();
  });

  it('rolls back help request status to open when insertXpEvent fails', async () => {
    const profilesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } })
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } })
        .mockResolvedValueOnce({ data: { level: 1 } }),
    });

    const helpRequestsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'hr-1', user_id: 'mentee-1', created_at: '2026-05-12T00:00:00Z' },
      }),
      update: vi.fn().mockReturnThis(),
    });

    helpRequestsMock.select = vi
      .fn()
      .mockImplementationOnce(() => helpRequestsMock)
      .mockResolvedValueOnce({ data: [{ id: 'hr-1' }], error: null });

    wire({
      profiles: profilesMock,
      help_requests: helpRequestsMock,
    });

    vi.mocked(insertXpEvent).mockRejectedValue(new Error('XP insertion failed'));

    await expect(run({ event: ev(), step })).rejects.toThrow('XP insertion failed');

    expect(helpRequestsMock.update).toHaveBeenLastCalledWith(
      expect.objectContaining({
        status: 'open',
        resolved_by: null,
        resolved_at: null,
      }),
    );
  });

  it('successfully resolves help request and awards XP', async () => {
    const profilesMock = sb({
      maybeSingle: vi
        .fn()
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } })
        .mockResolvedValueOnce({ data: { id: 'reviewer-id', level: 2 } })
        .mockResolvedValueOnce({ data: { level: 1 } }),
    });

    const helpRequestsMock = sb({
      maybeSingle: vi.fn().mockResolvedValue({
        data: { id: 'hr-1', user_id: 'mentee-1', created_at: '2026-05-12T00:00:00Z' },
      }),
      update: vi.fn().mockReturnThis(),
    });

    helpRequestsMock.select = vi
      .fn()
      .mockImplementationOnce(() => helpRequestsMock)
      .mockResolvedValueOnce({ data: [{ id: 'hr-1' }], error: null });

    wire({
      profiles: profilesMock,
      help_requests: helpRequestsMock,
    });

    vi.mocked(insertXpEvent).mockResolvedValue(true as never);

    const result = await run({ event: ev(), step });

    expect(result).toEqual({ xpAwarded: 65, isMentor: true, isFast: true });
    expect(insertXpEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'reviewer-id',
        xpDelta: 65,
      }),
    );
  });
});
