import { describe, it, expect } from 'vitest';
import { isSubstantive } from './process-review-event';

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
