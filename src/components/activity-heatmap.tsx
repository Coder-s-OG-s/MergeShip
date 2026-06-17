'use client';

type ActivityDay = {
  date: string;
  count: number;
};

interface ActivityHeatmapProps {
  activityHistory: ActivityDay[];
  allTimeContributions: number;
}

export function ActivityHeatmap({ activityHistory, allTimeContributions }: ActivityHeatmapProps) {
  // Convert history array to a lookup map
  const activityMap = new Map<string, number>();
  for (const item of activityHistory) {
    activityMap.set(item.date, item.count);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Display exactly 53 columns (weeks), each with 7 rows (Sunday to Saturday).
  // Find the Sunday of the week containing today.
  const currentDayOfWeek = today.getDay(); // 0 = Sunday
  const startOfCurrentWeek = new Date(today);
  startOfCurrentWeek.setDate(today.getDate() - currentDayOfWeek);

  const startDate = new Date(startOfCurrentWeek);
  startDate.setDate(startOfCurrentWeek.getDate() - 52 * 7); // 52 weeks ago Sunday

  // Generate 371 days (53 weeks × 7 days)
  const days: { dateStr: string; count: number; isFuture: boolean; label: string }[] = [];
  const runningDate = new Date(startDate);

  for (let i = 0; i < 371; i++) {
    const ymd = runningDate.toISOString().slice(0, 10);
    const count = activityMap.get(ymd) || 0;
    const isFuture = runningDate > today;
    const formattedDate = runningDate.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });

    days.push({
      dateStr: ymd,
      count,
      isFuture,
      label: isFuture ? '' : `${count} contribution${count === 1 ? '' : 's'} on ${formattedDate}`,
    });

    runningDate.setDate(runningDate.getDate() + 1);
  }

  // Calculate last-year contributions (for the "X Contributions" subtitle)
  const oneYearAgo = new Date(startDate);
  const lastYearContributions = activityHistory
    .filter((d) => d.date >= oneYearAgo.toISOString().slice(0, 10))
    .reduce((sum, d) => sum + d.count, 0);

  // Build month labels: for each week column (53 total), determine the month of its first day
  // We want to place a month label at the leftmost column of each new month
  const monthLabels: { col: number; label: string }[] = [];
  let lastMonth = -1;
  for (let col = 0; col < 53; col++) {
    const colStart = new Date(startDate);
    colStart.setDate(startDate.getDate() + col * 7);
    const month = colStart.getMonth();
    if (month !== lastMonth) {
      monthLabels.push({
        col,
        label: colStart.toLocaleDateString('en-US', { month: 'short' }),
      });
      lastMonth = month;
    }
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

  // Cell size
  const CELL = 11; // px
  const GAP = 2; // px
  const CELL_FULL = CELL + GAP; // 13px per cell

  return (
    <div>
      {/* All-time count above the card — matches design */}
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
              Activity Timeline (Last Year)
            </h3>
            <p className="mt-1 font-serif text-lg font-bold text-white">
              {lastYearContributions.toLocaleString()} Contributions
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

        <div className="overflow-x-auto pb-1">
          <div className="inline-block font-mono">
            {/* Month labels row */}
            <div
              className="relative mb-1 ml-8"
              style={{ width: `${53 * CELL_FULL - GAP}px`, height: '16px' }}
            >
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
                  width: `${53 * CELL_FULL - GAP}px`,
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
