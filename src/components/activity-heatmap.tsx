'use client';

type ActivityDay = {
  date: string;
  count: number;
};

interface ActivityHeatmapProps {
  activityHistory: ActivityDay[];
}

export function ActivityHeatmap({ activityHistory }: ActivityHeatmapProps) {
  // Convert history array to a lookup map
  const activityMap = new Map<string, number>();
  for (const item of activityHistory) {
    activityMap.set(item.date, item.count);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  // Display exactly 53 columns (weeks), each with 7 rows (Sunday to Saturday).
  // Find the Sunday of the week that was 52 weeks ago.
  const currentDayOfWeek = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const startOfCurrentWeek = new Date(today);
  startOfCurrentWeek.setDate(today.getDate() - currentDayOfWeek);

  const startDate = new Date(startOfCurrentWeek);
  startDate.setDate(startOfCurrentWeek.getDate() - 52 * 7); // 52 weeks ago Sunday

  // Generate 371 days (53 weeks)
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

  // Calculate stats for the summary
  const totalContributions = activityHistory.reduce((sum, item) => sum + item.count, 0);

  function getColorClass(count: number, isFuture: boolean) {
    if (isFuture) return 'bg-transparent cursor-default';
    if (count === 0) return 'bg-[#161b22] border border-[#21262d] hover:border-zinc-500';
    if (count === 1)
      return 'bg-emerald-900/60 border border-emerald-800/40 hover:border-emerald-600';
    if (count <= 3) return 'bg-emerald-800 border border-emerald-700/60 hover:border-emerald-500';
    if (count <= 5) return 'bg-emerald-600 border border-emerald-500/80 hover:border-emerald-400';
    return 'bg-emerald-400 border border-emerald-300 hover:border-white';
  }

  return (
    <div className="border border-[#21262d] bg-[#161b22]/50 p-6">
      <div className="mb-4 flex flex-col justify-between gap-2 sm:flex-row sm:items-center">
        <div>
          <h3 className="font-mono text-[11px] uppercase tracking-widest text-zinc-400">
            Activity Timeline (Last Year)
          </h3>
          <p className="mt-1 font-serif text-lg font-bold text-white">
            {totalContributions} Contributions
          </p>
        </div>
        <div className="flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
          <span>Less</span>
          <div className="h-3 w-3 rounded-sm border border-[#21262d] bg-[#161b22]" />
          <div className="h-3 w-3 rounded-sm border border-emerald-800/40 bg-emerald-900/60" />
          <div className="h-3 w-3 rounded-sm border border-emerald-700/60 bg-emerald-800" />
          <div className="h-3 w-3 rounded-sm border border-emerald-500/80 bg-emerald-600" />
          <div className="h-3 w-3 rounded-sm border border-emerald-300 bg-emerald-400" />
          <span>More</span>
        </div>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 font-mono">
        {/* Weekday labels column */}
        <div className="grid h-[105px] select-none grid-rows-7 pr-1 text-[9px] font-bold text-zinc-600">
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end">Mon</div>
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end">Wed</div>
          <div className="flex items-center justify-end" />
          <div className="flex items-center justify-end">Fri</div>
          <div className="flex items-center justify-end" />
        </div>

        {/* Heatmap Grid */}
        <div className="grid h-[105px] grid-flow-col grid-rows-7 gap-1">
          {days.map((day) => (
            <div
              key={day.dateStr}
              className={`h-3.5 w-3.5 rounded-sm transition-colors duration-150 ${getColorClass(day.count, day.isFuture)}`}
              title={day.label}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
