import { describe, it, expect } from 'vitest';
import { shouldFireTripwire, TRIPWIRE_THRESHOLD } from './tripwire';

describe('shouldFireTripwire', () => {
  it('does not fire on the first XP event of the day', () => {
    expect(shouldFireTripwire(0, 50)).toBe(false);
  });

  it('does not fire while accumulating under the threshold', () => {
    expect(shouldFireTripwire(500, 100)).toBe(false);
    expect(shouldFireTripwire(TRIPWIRE_THRESHOLD - 100, 50)).toBe(false);
  });

  it('fires exactly when the new total crosses the threshold', () => {
    expect(shouldFireTripwire(TRIPWIRE_THRESHOLD - 50, 100)).toBe(true);
    expect(shouldFireTripwire(0, TRIPWIRE_THRESHOLD + 1)).toBe(true);
  });

  it('does not fire if the user was already over the threshold', () => {
    // Today's count was already > threshold from a prior event — the
    // tripwire should only fire on the crossing event so we don't spam
    // activity_log with one row per future XP event.
    expect(shouldFireTripwire(TRIPWIRE_THRESHOLD + 200, 50)).toBe(false);
  });

  it('fires exactly at the threshold boundary', () => {
    expect(shouldFireTripwire(TRIPWIRE_THRESHOLD - 1, 1)).toBe(true);
  });

  it('handles negative deltas (clawback) safely', () => {
    // A penalty event can't trigger the tripwire.
    expect(shouldFireTripwire(TRIPWIRE_THRESHOLD - 100, -50)).toBe(false);
  });
});
