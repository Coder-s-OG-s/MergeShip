import { describe, it, expect } from 'vitest';
import { ok, err, isOk, isErr, type Result } from './result';

describe('Result<T>', () => {
  it('ok carries data', () => {
    const r = ok({ id: 1 });
    expect(isOk(r)).toBe(true);
    expect(isErr(r)).toBe(false);
    if (isOk(r)) expect(r.data.id).toBe(1);
  });

  it('err carries code, message, retryable', () => {
    const r = err('rate_limited', 'too many requests', true);
    expect(isErr(r)).toBe(true);
    if (isErr(r)) {
      expect(r.error.code).toBe('rate_limited');
      expect(r.error.message).toBe('too many requests');
      expect(r.error.retryable).toBe(true);
    }
  });

  it('err defaults retryable to false', () => {
    const r = err('bad_input', 'nope');
    if (isErr(r)) expect(r.error.retryable).toBe(false);
  });

  it('narrows type via isOk / isErr', () => {
    const r: Result<number> = Math.random() > -1 ? ok(42) : err('x', 'y');
    if (isOk(r)) {
      const _n: number = r.data;
      expect(_n).toBe(42);
    }
  });
});
