import { describe, it, expect } from 'vitest';
import { buildYearGrid } from './activity-heatmap';

describe('buildYearGrid', () => {
  it('starts on a Sunday on or before Jan 1', () => {
    // 2024: Jan 1 is Monday → grid should start Sun Dec 31 2023
    const result = buildYearGrid(2024, new Map());
    const firstDate = result.days[0]!.dateStr;
    expect(firstDate).toBe('2023-12-31');
  });

  it('ends on a Saturday on or after Dec 31', () => {
    // 2024: Dec 31 is Tuesday → grid includes padding into Jan 2025
    const result = buildYearGrid(2024, new Map());
    const lastDate = result.days[result.days.length - 1]!.dateStr;
    const lastDayOfWeek = new Date(lastDate + 'T00:00:00Z').getUTCDay();
    expect(lastDayOfWeek).toBe(6); // Saturday
  });

  it('returns the correct number of weeks for 2024', () => {
    // Dec 31 2023 (Sun) → Jan 4 2025 (Sat) = 53 weeks + 1 day → 54 cols
    const result = buildYearGrid(2024, new Map());
    expect(result.numCols).toBe(54);
    expect(result.days.length).toBe(54 * 7);
  });

  it('marks days outside the target year as future/padding', () => {
    const result = buildYearGrid(2024, new Map());
    // First cell is 2023-12-31 → should be marked future (padding)
    expect(result.days[0]!.isFuture).toBe(true);
    expect(result.days[0]!.count).toBe(0);
    // Last cells in Jan 2025 should also be padding
    const lastDay = result.days[result.days.length - 1]!;
    expect(lastDay.isFuture).toBe(true);
  });

  it('picks up activity counts for dates within the year', () => {
    const activityMap = new Map([
      ['2024-03-15', 5],
      ['2024-07-01', 2],
    ]);
    const result = buildYearGrid(2024, activityMap);
    const march15 = result.days.find((d) => d.dateStr === '2024-03-15');
    const july1 = result.days.find((d) => d.dateStr === '2024-07-01');
    expect(march15?.count).toBe(5);
    expect(july1?.count).toBe(2);
  });

  it('ignores activity counts for dates outside the year', () => {
    const activityMap = new Map([
      ['2023-12-31', 10], // padding day
      ['2025-01-01', 8], // padding day
    ]);
    const result = buildYearGrid(2024, activityMap);
    const dec31 = result.days.find((d) => d.dateStr === '2023-12-31');
    expect(dec31?.count).toBe(0);
  });

  it('sums contributions only for days within the year', () => {
    const activityMap = new Map([
      ['2023-12-31', 10], // outside — ignored
      ['2024-01-01', 3],
      ['2024-12-31', 7],
      ['2025-01-01', 5], // outside — ignored
    ]);
    const result = buildYearGrid(2024, activityMap);
    expect(result.contributions).toBe(10); // 3 + 7
  });

  it('generates month labels only for months within the target year', () => {
    const result = buildYearGrid(2024, new Map());
    const labels = result.monthLabels.map((m) => m.label);
    expect(labels).toContain('Jan');
    expect(labels).toContain('Dec');
    // Should have exactly 12 month labels
    expect(labels.length).toBe(12);
  });

  it('handles a year where Jan 1 falls on a Sunday (2023)', () => {
    // 2023: Jan 1 is Sunday → grid starts exactly on Jan 1
    const result = buildYearGrid(2023, new Map());
    expect(result.days[0]!.dateStr).toBe('2023-01-01');
    expect(result.days[0]!.isFuture).toBe(false);
  });

  it('handles a year where Dec 31 falls on a Saturday (2022)', () => {
    // 2022: Dec 31 is Saturday → last day within year is Dec 31
    const result = buildYearGrid(2022, new Map());
    const lastInYear = result.days.filter((d) => !d.isFuture);
    expect(lastInYear[lastInYear.length - 1]!.dateStr).toBe('2022-12-31');
  });
});
