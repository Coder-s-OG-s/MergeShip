import { type ContributorStats } from '@/app/actions/maintainer';

export function StatsBar({ stats }: { stats: ContributorStats }) {
  const avgTrustDisplay = stats.total > 0 ? `${stats.avgTrust}` : '—';

  const joinedDisplay =
    stats.joinedLast7d > 0 ? (
      <span className="flex items-center gap-1">
        <span>+{stats.joinedLast7d}</span>
        <span className="text-emerald-400">↗</span>
      </span>
    ) : (
      '0'
    );

  const items = [
    { label: 'TOTAL', value: stats.total.toString().padStart(2, '0') },
    { label: 'ACTIVE', value: stats.active.toString().padStart(2, '0') },
    { label: 'L2+ STATUS', value: stats.l2Plus.toString().padStart(2, '0') },
    { label: 'JOINED (7D)', value: joinedDisplay },
    { label: 'AVG TRUST', value: avgTrustDisplay },
    { label: 'PENDING', value: stats.pendingInvites.toString().padStart(2, '0') },
  ];

  return (
    <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-6">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex flex-col justify-center rounded-md border border-[#2d333b] bg-[#161b22] p-5"
        >
          <div className="mb-2 font-mono text-[10px] uppercase tracking-widest text-zinc-500">
            {item.label}
          </div>
          <div className="flex items-end font-serif text-3xl text-white md:text-4xl">
            {item.value}
          </div>
        </div>
      ))}
    </div>
  );
}
