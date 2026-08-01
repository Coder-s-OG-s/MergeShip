import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase/service';

export const dynamic = 'force-dynamic';

type SnapshotRow = {
  token: string;
  range: string;
  snapshot_data: {
    range: string;
    stats: {
      prsMerged: { value: number };
      avgReviewTimeHours: { value: number };
      queueSignalRate: { value: number };
      aiPrsBlocked: { value: number };
      contributorsLeveledUp: { value: number };
      maintainerTimeSavedHours: { value: number } | null;
    };
    prVolume: { date: string; merged: number; aiBlocked: number; stalled: number }[];
    repoBreakdown: {
      repoFullName: string;
      prsMerged: number;
      avgReviewHours: number | null;
      aiBlocked: number;
      activeContributors: number;
      signalRate: number;
    }[];
    generatedAt: string;
  };
  created_at: string;
  expires_at: string;
};

export default async function PublicReportPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const service = getServiceSupabase();
  if (!service) {
    notFound();
  }

  const { data: row } = await service
    .from('report_snapshots')
    .select('*')
    .eq('token', token)
    .maybeSingle();

  if (!row) {
    notFound();
  }

  const snapshot = row as SnapshotRow;
  const isExpired = new Date(snapshot.expires_at) < new Date();

  if (isExpired) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-6 text-center text-white">
        <div>
          <h1 className="mb-2 text-2xl font-bold">Report expired</h1>
          <p className="text-zinc-400">
            This shared report link expired on {new Date(snapshot.expires_at).toLocaleDateString()}.
          </p>
        </div>
      </div>
    );
  }

  const { stats, prVolume, repoBreakdown, generatedAt } = snapshot.snapshot_data;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8">
          <h1 className="font-display text-3xl font-bold">Analytics Report</h1>
          <p className="mt-1 text-sm text-zinc-500">
            {snapshot.range} · generated {new Date(generatedAt).toLocaleString()} · read-only
          </p>
        </header>

        <section className="mb-10 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
          <StatTile label="PRs Merged" value={stats.prsMerged.value} />
          <StatTile label="Avg Review Time" value={`${stats.avgReviewTimeHours.value}h`} />
          <StatTile label="Queue Signal Rate" value={`${stats.queueSignalRate.value}%`} />
          <StatTile label="AI PRs Blocked" value={stats.aiPrsBlocked.value} />
          <StatTile label="Contributors Leveled Up" value={stats.contributorsLeveledUp.value} />
          {stats.maintainerTimeSavedHours && (
            <StatTile
              label="Maintainer Time Saved"
              value={`${stats.maintainerTimeSavedHours.value}h`}
              highlight
            />
          )}
        </section>

        <section className="mb-10">
          <h2 className="mb-3 text-lg font-semibold">PR Volume</h2>
          <div className="overflow-x-auto rounded-lg border border-[#2d333b]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#161b22] text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Date</th>
                  <th className="px-4 py-2">Merged</th>
                  <th className="px-4 py-2">AI Blocked</th>
                  <th className="px-4 py-2">Stalled</th>
                </tr>
              </thead>
              <tbody>
                {prVolume.map((b) => (
                  <tr key={b.date} className="border-t border-[#2d333b]">
                    <td className="px-4 py-2">{b.date}</td>
                    <td className="px-4 py-2">{b.merged}</td>
                    <td className="px-4 py-2">{b.aiBlocked}</td>
                    <td className="px-4 py-2">{b.stalled}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section>
          <h2 className="mb-3 text-lg font-semibold">Breakdown by Repo</h2>
          <div className="overflow-x-auto rounded-lg border border-[#2d333b]">
            <table className="w-full text-left text-sm">
              <thead className="bg-[#161b22] text-zinc-400">
                <tr>
                  <th className="px-4 py-2">Repository</th>
                  <th className="px-4 py-2">PRs Merged</th>
                  <th className="px-4 py-2">Avg Review (h)</th>
                  <th className="px-4 py-2">AI Blocked</th>
                  <th className="px-4 py-2">Active Contributors</th>
                  <th className="px-4 py-2">Signal Rate</th>
                </tr>
              </thead>
              <tbody>
                {repoBreakdown.map((r) => (
                  <tr key={r.repoFullName} className="border-t border-[#2d333b]">
                    <td className="px-4 py-2">{r.repoFullName}</td>
                    <td className="px-4 py-2">{r.prsMerged}</td>
                    <td className="px-4 py-2">{r.avgReviewHours ?? '—'}</td>
                    <td className="px-4 py-2">{r.aiBlocked}</td>
                    <td className="px-4 py-2">{r.activeContributors}</td>
                    <td className="px-4 py-2">{r.signalRate}%</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </div>
  );
}

function StatTile({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string | number;
  highlight?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border p-4 ${
        highlight
          ? 'border-emerald-500/20 bg-emerald-950/20 ring-1 ring-emerald-500/20'
          : 'border-[#2d333b] bg-[#161b22]'
      }`}
    >
      <div className="text-xs uppercase tracking-wide text-zinc-500">{label}</div>
      <div className="mt-1 font-serif text-2xl">{value}</div>
    </div>
  );
}
