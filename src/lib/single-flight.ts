/**
 * In-process single-flight (a.k.a. request coalescing).
 *
 * When several callers ask for the same key while a first call is still in
 * flight, they all await that one in-flight promise instead of each doing the
 * work. This collapses a cache stampede — the thundering herd that hits an
 * origin the instant a hot cache entry expires — down to one upstream call per
 * key per process.
 *
 * Scope is a single Node process (one module-level map), so it is not a
 * distributed lock: in a multi-instance deployment each instance dedupes its
 * own concurrent callers. That is the right trade-off here — no network hop, no
 * deadlock risk — and it still removes the bulk of duplicate work because
 * concurrent reads of the same key usually land on the same warm instance.
 */

const inFlight = new Map<string, Promise<unknown>>();

/**
 * Run `fn` under `key`, sharing a single execution with any concurrent caller
 * using the same key. The slot is released as soon as the call settles, so a
 * failure is never cached — the next caller retries.
 */
export function singleFlight<T>(key: string, fn: () => Promise<T>): Promise<T> {
  const existing = inFlight.get(key) as Promise<T> | undefined;
  if (existing) return existing;

  let started: Promise<T>;
  try {
    started = fn();
  } catch (err) {
    // A synchronous throw has nothing to coalesce and never entered the map.
    return Promise.reject(err);
  }

  const tracked = started.then(
    (value) => {
      inFlight.delete(key);
      return value;
    },
    (err) => {
      inFlight.delete(key);
      throw err;
    },
  );

  inFlight.set(key, tracked);
  return tracked;
}

// Test-only: clear any in-flight entries so cases can't leak across tests.
export function __resetSingleFlight(): void {
  inFlight.clear();
}
