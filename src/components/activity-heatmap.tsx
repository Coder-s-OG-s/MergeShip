'use client';

import { useState } from 'react';

type ActivityDay = {
  date: string;
  count: number;
};

interface ActivityHeatmapProps {
  activityHistory: ActivityDay[];
  allTimeContributions: number;
}

// GitHub-style green color scale
function getColor(count: number, isFuture: boolean): string {
  if (isFuture) return 'bg-transparent cursor-default';
  if (count === 0)
    return 'bg-[#161b22] border border-[#21262d] hover:border-zinc-500 cursor-default';
  if (count === 1) return 'bg-[#0e4429] border border-[#196c2e]/60 hover:border-[#39d353]/60';
  if (count <= 3) return 'bg-[#006d32] border border-[#26a641]/60 hover:border-[#39d353]/80';
  if (count <= 6) return 'bg-[#26a641] border border-[#39d353]/60 hover:border-[#39d353]';
  return 'bg-[#39d353] border border-[#39d353]/80 hover:border-white';
}

// Cell dimensions
const CELL = 11; // px
const GAP = 2; // px
const CELL_FULL = CELL + GAP; // 13px per cell

/**
 * Build the day/week grid for the "last 53 weeks" (trailing) view — current year mode.
 */
export function buildTrailingGrid(activityMap: Map<string, number>, now = new Date()) {
  const today = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const currentDayOfWeek = today.getUTCDay(); // 0 = Sunday
  const startOfCurrentWeek = new Date(today);
  startOfCurrentWeek.setUTCDate(today.getUTCDate() - currentDayOfWeek);

  const startDate = new Date(startOfCurrentWeek);
  startDate.setUTCDate(startOfCurrentWeek.getUTCDate() - 52 * 7); // 52 weeks ago Sunday

  const days: { dateStr: string; count: number; isFuture: boolean; label: string }[] = [];
  const runningDate = new Date(startDate);

  for (let i = 0; i < 371; i++) {
    const ymd = runningDate.toISOString().slice(0, 10);
    const count = activityMap.get(ymd) ?? 0;
    const isFuture = runningDate > today;
    const formattedDate = runningDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    days.push({
      dateStr: ymd,
      count,
      isFuture,
      label: isFuture ? '' : `${count} contribution${count === 1 ? '' : 's'} on ${formattedDate}`,
    });
    runningDate.setUTCDate(runningDate.getUTCDate() + 1);
  }

  // Month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < 53; col++) {
    const colStart = new Date(startDate);
    colStart.setUTCDate(startDate.getUTCDate() + col * 7);
    const month = colStart.getUTCMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        col,
        label: colStart.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      });
      lastMonth = month;
    }
  }

  // Count contributions in this window
  const windowStart = startDate.toISOString().slice(0, 10);
  const contributions = days
    .filter((d) => !d.isFuture && d.dateStr >= windowStart)
    .reduce((sum, d) => sum + d.count, 0);

  return { days, monthLabels, numCols: 53, contributions };
}

/**
 * Build the full Jan 1 – Dec 31 grid for a specific past year, Sunday-aligned.
 * The grid starts on the Sunday on or before Jan 1 and ends on the Saturday
 * on or after Dec 31 of the given year — same approach GitHub uses.
 */
export function buildYearGrid(year: number, activityMap: Map<string, number>) {
  const jan1 = new Date(Date.UTC(year, 0, 1));
  const dec31 = new Date(Date.UTC(year, 11, 31));

  // Align start to the Sunday on or before Jan 1
  const startDate = new Date(jan1);
  startDate.setUTCDate(jan1.getUTCDate() - jan1.getUTCDay());

  // Align end to the Saturday on or after Dec 31
  const endDate = new Date(dec31);
  const daysUntilSat = (6 - dec31.getUTCDay() + 7) % 7;
  endDate.setUTCDate(dec31.getUTCDate() + daysUntilSat);

  // Calculate number of weeks
  const totalMs = endDate.getTime() - startDate.getTime();
  const numCols = Math.round(totalMs / (7 * 24 * 60 * 60 * 1000)) + 1;

  const days: { dateStr: string; count: number; isFuture: boolean; label: string }[] = [];
  const runningDate = new Date(startDate);
  const totalDays = numCols * 7;

  for (let i = 0; i < totalDays; i++) {
    const ymd = runningDate.toISOString().slice(0, 10);
    // Days outside Jan 1 – Dec 31 are padding (shown as future/empty)
    const isOutsideYear = runningDate.getUTCFullYear() !== year;
    const count = isOutsideYear ? 0 : (activityMap.get(ymd) ?? 0);
    const formattedDate = runningDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      timeZone: 'UTC',
    });
    days.push({
      dateStr: ymd,
      count,
      isFuture: isOutsideYear,
      label: isOutsideYear
        ? ''
        : `${count} contribution${count === 1 ? '' : 's'} on ${formattedDate}`,
    });
    runningDate.setUTCDate(runningDate.getUTCDate() + 1);
  }

  // Month labels
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < numCols; col++) {
    const colStart = new Date(startDate);
    colStart.setUTCDate(startDate.getUTCDate() + col * 7);
    const month = colStart.getUTCMonth();
    if (month !== lastMonth && colStart.getUTCFullYear() === year) {
      monthLabels.push({
        col,
        label: colStart.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }),
      });
      lastMonth = month;
    }
  }

  // Count only days within the year
  const contributions = days.filter((d) => !d.isFuture).reduce((sum, d) => sum + d.count, 0);

  return { days, monthLabels, numCols, contributions };
}

export function ActivityHeatmap({ activityHistory, allTimeContributions }: ActivityHeatmapProps) {
  const currentYear = new Date().getFullYear();

  // Derive sorted list of years that have any contributions
  const yearsWithData = Array.from(
    new Set(activityHistory.map((d) => parseInt(d.date.slice(0, 4), 10))),
  ).sort((a, b) => b - a); // descending: newest first

  // Always include the current year even if no data yet
  if (!yearsWithData.includes(currentYear)) {
    yearsWithData.unshift(currentYear);
  }

  // Default to current year (trailing view)
  const [selectedYear, setSelectedYear] = useState<number>(currentYear);

  // Build activity lookup map
  const activityMap = new Map<string, number>();
  for (const item of activityHistory) {
    activityMap.set(item.date, item.count);
  }

  // Build the appropriate grid
  const { days, monthLabels, numCols, contributions } =
    selectedYear === currentYear
      ? buildTrailingGrid(activityMap)
      : buildYearGrid(selectedYear, activityMap);

  const gridWidth = numCols * CELL_FULL - GAP;

  return (
    <div>
      {/* All-time count above the card */}
      <p className="mb-3 font-mono text-[11px] uppercase tracking-widest text-zinc-500">
        All-Time Contributions:{' '}
        <span className="text-[#39d353]">{allTimeContributions.toLocaleString()}</span>
      </p>

      {/* Card */}
      <div className="border border-[#21262d] bg-[#161b22]/50 p-5">
        {/* Header row */}
        <div className="mb-3 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
          <div>
            <h3 className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
              {selectedYear === currentYear
                ? 'Activity Timeline (Last Year)'
                : `Activity Timeline (${selectedYear})`}
            </h3>
            <p className="mt-1 font-serif text-lg font-bold text-white">
              {contributions.toLocaleString()} Contributions
            </p>
          </div>
          {/* Legend */}
          <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            <span>Less</span>
            <div className="h-[11px] w-[11px] rounded-sm border border-[#21262d] bg-[#161b22]" />
            <div className="h-[11px] w-[11px] rounded-sm border border-[#196c2e]/60 bg-[#0e4429]" />
            <div className="h-[11px] w-[11px] rounded-sm border border-[#26a641]/60 bg-[#006d32]" />
            <div className="h-[11px] w-[11px] rounded-sm border border-[#39d353]/60 bg-[#26a641]" />
            <div className="h-[11px] w-[11px] rounded-sm border border-[#39d353]/80 bg-[#39d353]" />
            <span>More</span>
          </div>
        </div>

        {/* Year selector tabs */}
        <div className="mb-4 flex flex-wrap gap-1.5">
          {yearsWithData.map((year) => (
            <button
              key={year}
              onClick={() => setSelectedYear(year)}
              className={`rounded-sm px-2.5 py-0.5 font-mono text-[10px] uppercase tracking-widest transition-colors duration-150 ${
                selectedYear === year
                  ? 'bg-[#39d353] text-black'
                  : 'border border-[#21262d] bg-[#161b22] text-zinc-400 hover:border-[#39d353]/50 hover:text-zinc-200'
              }`}
              role="tab"
              aria-selected={selectedYear === year}
            >
              {year}
            </button>
          ))}
        </div>

        <div className="overflow-x-auto overflow-y-hidden pb-3">
          <div className="inline-block font-mono">
            {/* Month labels row */}
            <div className="relative mb-1 ml-8" style={{ width: `${gridWidth}px`, height: '16px' }}>
              {monthLabels.map(({ col, label }) => (
                <span
                  key={`${col}-${label}`}
                  className="absolute text-[10px] uppercase tracking-widest text-zinc-500"
                  style={{ left: `${col * CELL_FULL}px` }}
                >
                  {label}
                </span>
              ))}
            </div>

            {/* Grid with weekday labels */}
            <div className="flex gap-1.5">
              {/* Weekday labels */}
              <div
                className="flex select-none flex-col justify-between text-right text-[9px] font-bold text-zinc-600"
                style={{ width: '24px', height: `${7 * CELL_FULL - GAP}px` }}
              >
                <span className="invisible">Sun</span>
                <span>Mon</span>
                <span className="invisible">Tue</span>
                <span>Wed</span>
                <span className="invisible">Thu</span>
                <span>Fri</span>
                <span className="invisible">Sat</span>
              </div>

              {/* Heatmap Grid: column-major (each week is a column) */}
              <div
                className="grid grid-flow-col"
                style={{
                  gridTemplateRows: `repeat(7, ${CELL}px)`,
                  gap: `${GAP}px`,
                  width: `${gridWidth}px`,
                  height: `${7 * CELL_FULL - GAP}px`,
                }}
              >
                {days.map((day) => (
                  <div
                    key={day.dateStr}
                    className={`rounded-sm transition-colors duration-150 ${getColor(day.count, day.isFuture)}`}
                    style={{ width: `${CELL}px`, height: `${CELL}px` }}
                    title={day.label}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
