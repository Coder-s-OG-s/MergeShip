'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { CheckCircle2, Circle, Loader2 } from 'lucide-react';
import RepoNameTicker from './repo-name-ticker';

type TaskStatus = 'pending' | 'active' | 'completed';

const INITIAL_STATUSES: TaskStatus[] = ['active', 'pending', 'pending'];

type CompletionSummaryCardProps = {
  managedNames: string[];
  autoAssignMentorChain: boolean;
};

export default function CompletionSummaryCard({
  managedNames,
  autoAssignMentorChain,
}: CompletionSummaryCardProps) {
  const [statuses, setStatuses] = useState<TaskStatus[]>(INITIAL_STATUSES);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setStatuses(['completed', 'active', 'pending']);
    }, 900);

    const t2 = setTimeout(() => {
      setStatuses(['completed', 'completed', 'active']);
    }, 1800);

    const t3 = setTimeout(() => {
      setStatuses(['completed', 'completed', 'completed']);
    }, 2700);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  return (
    <div className="mt-10 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 text-left">
      <SummaryRow
        status={statuses[0] ?? 'pending'}
        label="Repos connected"
        badge={managedNames.length > 0 ? String(managedNames.length) : undefined}
      >
        <RepoNameTicker
          names={managedNames}
          className="text-sm font-medium text-white"
          emptyLabel="No repos connected"
        />
      </SummaryRow>

      <SummaryRow status={statuses[1] ?? 'pending'} label="AI-generated PR detection">
        <span className="text-sm text-zinc-500">Not configured yet</span>
      </SummaryRow>

      <SummaryRow status={statuses[2] ?? 'pending'} label="Mentor chain" last>
        <span className="text-sm font-medium text-white">
          {autoAssignMentorChain ? (
            <>
              On <span className="text-zinc-500">— routing L0/L1 to senior maintainers</span>
            </>
          ) : (
            <span className="text-zinc-500">Off</span>
          )}
        </span>
      </SummaryRow>
    </div>
  );
}

function SummaryRow({
  status,
  label,
  badge,
  last,
  children,
}: {
  status: TaskStatus;
  label: string;
  badge?: string;
  last?: boolean;
  children: ReactNode;
}) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-4 ${
        last ? '' : 'border-b border-zinc-800/60'
      }`}
    >
      <div className="flex items-center gap-2.5">
        <TaskIcon status={status} />
        <span
          className={`text-sm ${
            status === 'pending'
              ? 'text-zinc-600'
              : status === 'active'
                ? 'text-zinc-200'
                : 'text-zinc-300'
          }`}
        >
          {label}
        </span>
        {badge && (
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums ${
              status === 'pending' ? 'bg-zinc-900 text-zinc-600' : 'bg-zinc-800 text-zinc-300'
            }`}
          >
            {badge}
          </span>
        )}
      </div>
      <div
        className={`min-w-0 max-w-[55%] text-right ${
          status === 'pending' ? 'opacity-55' : 'opacity-100'
        }`}
      >
        {children}
      </div>
    </div>
  );
}

function TaskIcon({ status }: { status: TaskStatus }) {
  if (status === 'completed') {
    return <CheckCircle2 className="h-4 w-4 text-neon-green" />;
  }
  if (status === 'active') {
    return <Loader2 className="h-4 w-4 animate-spin text-amber-400" />;
  }
  return <Circle className="h-4 w-4 text-zinc-700" />;
}
