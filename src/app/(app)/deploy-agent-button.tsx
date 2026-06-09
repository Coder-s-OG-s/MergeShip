'use client';

import { useState } from 'react';
import { Terminal } from 'lucide-react';

export function DeployAgentButton() {
  const [isDeploying, setIsDeploying] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);
  const [status, setStatus] = useState<'idle' | 'running' | 'success'>('idle');

  const startDeployment = () => {
    setIsDeploying(true);
    setStatus('running');
    setLogs([
      '[SYSTEM] Initializing Agent Deployment...',
      '[SYSTEM] Connecting to secure gateway...',
    ]);

    const steps = [
      '[SYSTEM] Authenticating with GitHub API...',
      '[SYSTEM] Loading contribution neural models...',
      '[SYSTEM] Resolving local worktrees...',
      '[SYSTEM] Running code safety auditor...',
      '[SYSTEM] Verification checks passed (100% confidence).',
      '[SYSTEM] Deploying Agent container...',
      '[SYSTEM] Agent successfully registered as active!',
    ];

    steps.forEach((step, index) => {
      setTimeout(
        () => {
          setLogs((prev) => [...prev, step]);
          if (index === steps.length - 1) {
            setStatus('success');
          }
        },
        (index + 1) * 600,
      );
    });
  };

  return (
    <>
      <button
        onClick={startDeployment}
        className="mt-2 w-full border border-transparent bg-[#00FF87] py-3 font-mono text-[11px] font-bold uppercase tracking-widest text-[#0D0E12] shadow-[0_0_15px_rgba(0,255,135,0.15)] transition-colors hover:bg-[#00FF87]/80 hover:shadow-[0_0_20px_rgba(0,255,135,0.3)]"
      >
        DEPLOY AGENT
      </button>

      {isDeploying && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm">
          <div className="animate-in fade-in zoom-in w-full max-w-lg overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0E12] font-mono text-xs text-white shadow-2xl duration-200">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-4 py-3">
              <div className="flex items-center gap-2 text-zinc-400">
                <Terminal className="h-4 w-4 text-[#00FF87]" />
                <span>AGENT DEPLOYMENT CONSOLE</span>
              </div>
              {status === 'running' && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[#00FF87] opacity-75"></span>
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-[#00FF87]"></span>
                </span>
              )}
            </div>

            {/* Logs Area */}
            <div className="h-64 space-y-2 overflow-y-auto bg-[#08090C] p-4 text-zinc-300">
              {logs.map((log, i) => (
                <div
                  key={i}
                  className={
                    log.includes('successfully') || log.includes('passed') ? 'text-[#00FF87]' : ''
                  }
                >
                  {log}
                </div>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-zinc-800 bg-zinc-950 px-4 py-3">
              <span className="text-zinc-500">
                STATUS: {status === 'running' ? 'DEPLOYING...' : 'ONLINE'}
              </span>
              {status === 'success' && (
                <button
                  onClick={() => {
                    setIsDeploying(false);
                    setStatus('idle');
                    setLogs([]);
                  }}
                  className="bg-zinc-800 px-4 py-1.5 font-bold uppercase text-white transition-colors hover:bg-zinc-700"
                >
                  Close
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
