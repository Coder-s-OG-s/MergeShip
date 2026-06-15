'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import { motion } from 'framer-motion';
import { CheckCircle2, Loader2, Circle } from 'lucide-react';

type TaskStatus = 'pending' | 'active' | 'completed';

interface Task {
  id: number;
  label: string;
  completedDuration: string | null;
}

const TASKS: Task[] = [
  { id: 1, label: 'Reading public profile', completedDuration: '0.3s' },
  { id: 2, label: 'Fetching repo history', completedDuration: '1.1s' },
  { id: 3, label: 'Counting merged PRs', completedDuration: '0.8s' },
  { id: 4, label: 'Evaluating contribution quality', completedDuration: '1.4s' },
  { id: 5, label: 'Calculating trust score', completedDuration: '0.7s' },
  { id: 6, label: 'Assigning placement level', completedDuration: '0.5s' },
];

const INITIAL_STATUSES: TaskStatus[] = [
  'completed',
  'completed',
  'completed',
  'active',
  'pending',
  'pending',
];

function generateProcessId(): string {
  const hex = Array.from({ length: 6 }, () => Math.floor(Math.random() * 16).toString(16)).join('');
  return `Running process_id_${hex}...`;
}

export function OnboardingClient({
  avatarUrl,
  githubHandle,
}: {
  avatarUrl: string | null;
  githubHandle: string;
}) {
  const router = useRouter();
  const [processId] = useState(generateProcessId);
  const [taskStatuses, setTaskStatuses] = useState<TaskStatus[]>(INITIAL_STATUSES);
  const [progress, setProgress] = useState(50);

  useEffect(() => {
    const t1 = setTimeout(() => {
      setTaskStatuses((prev) => {
        const next = [...prev];
        next[3] = 'completed';
        next[4] = 'active';
        return next;
      });
      setProgress(66);
    }, 1500);

    const t2 = setTimeout(() => {
      setTaskStatuses((prev) => {
        const next = [...prev];
        next[4] = 'completed';
        next[5] = 'active';
        return next;
      });
      setProgress(83);
    }, 3000);

    const t3 = setTimeout(() => {
      setTaskStatuses((prev) => {
        const next = [...prev];
        next[5] = 'completed';
        return next;
      });
      setProgress(100);
    }, 4200);

    const t4 = setTimeout(() => {
      router.push('/dashboard');
    }, 5000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      clearTimeout(t4);
    };
  }, [router]);

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-8">
      <div className="flex w-full items-center">
        <span className="font-display text-xl font-bold tracking-wider text-white">MERGESHIP</span>
      </div>

      <div className="flex w-full flex-col gap-2">
        <span className="text-[11px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Step 2 of 3
        </span>
        <div className="h-1.5 w-full overflow-hidden rounded-full bg-zinc-800">
          <motion.div
            className="h-full rounded-full"
            style={{
              background: 'linear-gradient(90deg, #00FF87, #00FF87, #00CC6A)',
              boxShadow: '0 0 8px rgba(0,255,135,0.4)',
            }}
            initial={{ width: '50%' }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
          />
        </div>
      </div>

      <div className="scan-avatar-ring flex items-center justify-center">
        <div className="flex h-20 w-20 animate-scan-avatar items-center justify-center overflow-hidden rounded-full bg-zinc-800 ring-2 ring-neon-green/30">
          {avatarUrl ? (
            <Image
              src={avatarUrl}
              alt={githubHandle}
              width={80}
              height={80}
              className="h-full w-full object-cover"
              unoptimized
            />
          ) : (
            <span className="font-display text-xl font-bold text-zinc-500">
              {githubHandle.substring(0, 2).toUpperCase()}
            </span>
          )}
        </div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        className="scan-card w-full overflow-hidden rounded-xl"
      >
        <div className="flex items-center justify-between border-b border-zinc-800/60 px-5 py-3">
          <span className="inline-flex items-center rounded-full bg-neon-green/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-neon-green">
            SCANNING
          </span>
          <span className="font-mono text-[11px] text-zinc-500">{processId}</span>
        </div>

        <div className="px-5 py-3">
          {TASKS.map((task, index) => {
            const status: TaskStatus = taskStatuses[index] ?? 'pending';
            return (
              <motion.div
                key={task.id}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: index * 0.08 }}
                className="flex items-center justify-between py-2.5"
              >
                <div className="flex items-center gap-3">
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
                    {task.label}
                  </span>
                </div>
                <span className="font-mono text-xs tabular-nums text-zinc-500">
                  <TaskDuration status={status} completedDuration={task.completedDuration} />
                </span>
              </motion.div>
            );
          })}
        </div>
      </motion.div>

      <p className="text-[13px] text-zinc-600">This usually takes under 10 seconds.</p>
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

function TaskDuration({
  status,
  completedDuration,
}: {
  status: TaskStatus;
  completedDuration: string | null;
}) {
  if (status === 'active') return <span>...</span>;
  if (status === 'pending') return <span>--</span>;
  return <span>{completedDuration ?? '0.0s'}</span>;
}
