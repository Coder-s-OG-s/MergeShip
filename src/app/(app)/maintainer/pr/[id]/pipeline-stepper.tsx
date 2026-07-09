import { Check, Hourglass, GitMerge } from 'lucide-react';
import React from 'react';

export type StepperNode = {
  label: string;
  subLabel?: string;
  status: 'completed' | 'current' | 'pending';
  iconType?: 'check' | 'hourglass' | 'merge' | 'dot';
};

export function PipelineStepper({ nodes }: { nodes: StepperNode[] }) {
  return (
    <div className="rounded-sm border border-zinc-800/80 bg-[#0c0c0e] px-8 py-8 shadow-sm">
      <div className="relative flex items-center justify-between">
        {/* Background Line */}
        <div className="absolute left-0 top-6 -z-10 h-[2px] w-full bg-zinc-800/80" />

        {nodes.map((node, i) => {
          const isLast = i === nodes.length - 1;
          const isCompleted = node.status === 'completed';
          const isCurrent = node.status === 'current';

          // Line to the next node
          const nextNode = isLast ? null : nodes[i + 1];
          const lineIsGreen = !isLast && isCompleted && nextNode?.status !== 'pending';
          const showDot = isCompleted && nextNode?.status === 'current';

          return (
            <React.Fragment key={i}>
              <div className="relative flex flex-col items-center bg-[#0c0c0e] px-4">
                {/* Node Circle */}
                <div
                  className={`flex h-[42px] w-[42px] items-center justify-center rounded-full border-[1.5px] ${
                    isCompleted
                      ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                      : isCurrent
                        ? 'border-emerald-500 bg-emerald-950/20 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]'
                        : 'border-zinc-800 bg-[#0c0c0e] text-zinc-600'
                  }`}
                >
                  {node.iconType === 'check' || (isCompleted && !node.iconType) ? (
                    <Check className="h-5 w-5" />
                  ) : node.iconType === 'hourglass' || (isCurrent && !node.iconType) ? (
                    <Hourglass className="h-4 w-4" />
                  ) : node.iconType === 'merge' ? (
                    <GitMerge className="h-4 w-4" />
                  ) : (
                    <div className="h-1.5 w-1.5 rounded-full bg-zinc-600" />
                  )}
                </div>

                {/* Labels */}
                <div className="mt-4 text-center font-mono">
                  <div
                    className={`text-xs font-semibold ${
                      isCompleted || isCurrent ? 'text-emerald-400' : 'text-zinc-600'
                    }`}
                  >
                    {node.label}
                  </div>
                  {node.subLabel && (
                    <div
                      className={`mt-1.5 text-[10px] ${
                        isCurrent
                          ? 'font-semibold text-emerald-400/80'
                          : isCompleted
                            ? 'text-zinc-500'
                            : 'text-zinc-600'
                      }`}
                    >
                      {node.subLabel}
                    </div>
                  )}
                </div>
              </div>

              {/* Connecting Line */}
              {!isLast && (
                <div className="relative -z-10 flex flex-1 items-center justify-center bg-[#0c0c0e]">
                  <div
                    className={`h-[2px] w-full ${
                      lineIsGreen || showDot ? 'bg-emerald-500' : 'bg-zinc-800/80'
                    }`}
                  />
                  {showDot && (
                    <div className="absolute right-0 z-10 h-2 w-2 translate-x-1/2 rounded-full bg-emerald-400 shadow-[0_0_8px_rgba(52,248,152,0.8)]" />
                  )}
                </div>
              )}
            </React.Fragment>
          );
        })}
      </div>
    </div>
  );
}
