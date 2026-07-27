import { describe, it, expect, beforeEach } from 'vitest';
import { singleFlight, __resetSingleFlight } from './single-flight';

beforeEach(() => __resetSingleFlight());

describe('singleFlight', () => {
  it('runs fn once for concurrent callers of the same key', async () => {
    let calls = 0;
    let release: (v: number) => void = () => {};
    const gate = new Promise<number>((r) => (release = r));
    const fn = () => {
      calls++;
      return gate;
    };

    const a = singleFlight('k', fn);
    const b = singleFlight('k', fn);
    const c = singleFlight('k', fn);
    expect(calls).toBe(1);

    release(7);
    expect(await Promise.all([a, b, c])).toEqual([7, 7, 7]);
  });

  it('isolates different keys', async () => {
    let calls = 0;
    const fn = async () => ++calls;
    const [x, y] = await Promise.all([singleFlight('a', fn), singleFlight('b', fn)]);
    expect(calls).toBe(2);
    expect(new Set([x, y]).size).toBe(2);
  });

  it('re-runs fn after the previous call settles', async () => {
    let calls = 0;
    const fn = async () => ++calls;
    await singleFlight('k', fn);
    await singleFlight('k', fn);
    expect(calls).toBe(2);
  });

  it('rejects every concurrent caller when fn throws', async () => {
    const fn = async () => {
      throw new Error('boom');
    };
    const a = singleFlight('k', fn);
    const b = singleFlight('k', fn);
    await expect(a).rejects.toThrow('boom');
    await expect(b).rejects.toThrow('boom');
  });

  it('does not cache a failure — a later call retries', async () => {
    let calls = 0;
    const fn = async () => {
      calls++;
      if (calls === 1) throw new Error('first fails');
      return 'ok';
    };
    await expect(singleFlight('k', fn)).rejects.toThrow('first fails');
    await expect(singleFlight('k', fn)).resolves.toBe('ok');
    expect(calls).toBe(2);
  });

  it('normalises a synchronous throw into a rejection and clears the slot', async () => {
    const throwing = (() => {
      throw new Error('sync boom');
    }) as () => Promise<never>;
    await expect(singleFlight('k', throwing)).rejects.toThrow('sync boom');
    await expect(singleFlight('k', async () => 'recovered')).resolves.toBe('recovered');
  });
});
