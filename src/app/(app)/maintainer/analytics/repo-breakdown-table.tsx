import { Folder } from 'lucide-react';
import type { RepoAnalyticsRow } from '@/app/actions/maintainer/analytics';

export function RepoBreakdownTable({ data }: { data: RepoAnalyticsRow[] }) {
  if (data.length === 0) {
    return (
      <div className="text-muted-foreground rounded-md border p-4 text-center text-sm">
        No repositories found for this installation.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-md border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 border-b">
          <tr>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              REPOSITORY
            </th>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              PRS MERGED
            </th>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              AVG REVIEW
            </th>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              AI BLOCKED
            </th>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              CONTRIBUTORS
            </th>
            <th className="text-muted-foreground h-10 whitespace-nowrap px-4 text-left font-medium">
              SIGNAL RATE
            </th>
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr
              key={row.repoFullName}
              className="hover:bg-muted/50 border-b transition-colors last:border-0"
            >
              <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                  <Folder className="text-muted-foreground h-4 w-4" />
                  <span className="font-medium">{row.repoFullName}</span>
                </div>
              </td>
              <td className="p-4 align-middle">
                <div className="flex items-center gap-2">
                  <span>{row.prsMerged}</span>
                  {row.prsMergedDelta > 0 && (
                    <span className="font-medium text-emerald-500">↑</span>
                  )}
                  {row.prsMergedDelta < 0 && <span className="font-medium text-rose-500">↓</span>}
                </div>
              </td>
              <td className="p-4 align-middle">
                {row.avgReviewHours !== null ? `${row.avgReviewHours.toFixed(1)}h` : '—'}
              </td>
              <td className="p-4 align-middle">
                {row.aiBlocked > 0 ? (
                  <span className="font-medium text-rose-500">{row.aiBlocked}</span>
                ) : (
                  <span>0</span>
                )}
              </td>
              <td className="whitespace-nowrap p-4 align-middle">
                {row.activeContributors} active
              </td>
              <td className="p-4 align-middle">
                <span
                  className={
                    row.signalRate >= 80
                      ? 'font-medium text-emerald-500'
                      : row.signalRate >= 50
                        ? 'font-medium text-amber-500'
                        : 'font-medium text-rose-500'
                  }
                >
                  {row.signalRate.toFixed(0)}%
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
