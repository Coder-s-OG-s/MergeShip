import type { ContributorFunnelData } from '@/app/actions/maintainer/types';

export function ContributorFunnel({ data }: { data: ContributorFunnelData }) {
  const max = data.registered || 1;
  const steps = [
    { label: 'Registered', value: data.registered },
    { label: 'First PR', value: data.firstPr },
    { label: 'L2 Promoted', value: data.l2Promoted },
  ];

  return (
    <div className="rounded-xl border border-zinc-800 bg-[#161b22] p-5">
      <div className="mb-4 text-[10px] uppercase tracking-widest text-zinc-500">
        CONTRIBUTOR FUNNEL
      </div>
      <div className="space-y-4">
        {steps.map((step) => (
          <div key={step.label}>
            <div className="mb-1 flex justify-between text-xs">
              <span className="text-zinc-400">{step.label}</span>
              <span className="font-mono text-white">{step.value.toLocaleString()}</span>
            </div>
            <div className="h-2 w-full rounded-full bg-zinc-800">
              <div
                className="h-2 rounded-full bg-emerald-400 transition-all"
                style={{ width: `${Math.round((step.value / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
