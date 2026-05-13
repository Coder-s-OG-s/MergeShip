'use client';

import { useState } from 'react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import { Github, BarChart2, Rocket, Lock } from 'lucide-react';

export default function LoginPage() {
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    try {
      setLoading(true);
      const origin = window.location.origin;
      const sb = getBrowserSupabase();
      if (!sb) {
        console.error('Supabase client not initialized');
        return;
      }
      await sb.auth.signInWithOAuth({
        provider: 'github',
        options: { redirectTo: `${origin}/api/auth/callback?next=/analyzing` },
      });
    } catch (error) {
      console.error('Error logging in:', error);
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#0d1117] p-4 font-sans">
      {/* Background Grid Pattern */}
      <div
        className="pointer-events-none absolute inset-0 z-0 opacity-20"
        style={{
          backgroundImage:
            'linear-gradient(to right, #1f2937 1px, transparent 1px), linear-gradient(to bottom, #1f2937 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }}
      />

      {/* Subtle green glow behind the card */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 z-0 h-[400px] w-[600px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-green-500/10 blur-[120px]" />

      {/* Main Card */}
      <div className="relative z-10 w-full max-w-[560px] rounded-xl border border-zinc-800 bg-[#161b22]/90 p-10 shadow-2xl backdrop-blur-xl">
        {/* Header */}
        <div className="mb-8 flex flex-col items-center">
          <div className="mb-2 flex items-center gap-3">
            {/* Simple Ship SVG Logo */}
            <svg
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 21c.6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1 .6.5 1.2 1 2.5 1 2.5 0 2.5-2 5-2 1.3 0 1.9.5 2.5 1" />
              <path d="M19.38 20A11.6 11.6 0 0 0 21 14l-9-4-9 4c0 2.9.94 5.34 2.81 7.76" />
              <path d="M19 13V7a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v6" />
              <path d="M12 10v4" />
              <path d="M12 2v3" />
            </svg>
            <h1 className="text-3xl font-bold tracking-tight text-white">MergeShip</h1>
          </div>
          <p className="text-[15px] text-zinc-400">Learn open source. The right way.</p>
        </div>

        {/* GitHub Button */}
        <button
          onClick={handleLogin}
          disabled={loading}
          className="group mb-10 flex w-full items-center justify-center gap-3 rounded-md border border-zinc-700 bg-[#21262d] px-4 py-3.5 font-medium text-white transition-colors duration-200 hover:bg-[#30363d] disabled:cursor-not-allowed disabled:opacity-70"
        >
          {loading ? (
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-zinc-400 border-t-white" />
          ) : (
            <Github className="h-5 w-5 text-zinc-300 transition-colors group-hover:text-white" />
          )}
          {loading ? 'Connecting...' : 'Continue with GitHub'}
        </button>

        {/* Divider */}
        <div className="mb-8 flex items-center gap-4">
          <div className="h-px flex-1 bg-zinc-800" />
          <span className="font-mono text-[11px] uppercase tracking-widest text-zinc-500">
            What happens next?
          </span>
          <div className="h-px flex-1 bg-zinc-800" />
        </div>

        {/* Info Blocks */}
        <div className="mb-10 grid grid-cols-1 gap-4 md:grid-cols-3">
          <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-[#1c2128] p-4 text-center">
            <div className="mb-3 rounded-md bg-[#2d333b] p-2 text-zinc-400">
              <Github className="h-4 w-4" />
            </div>
            <p className="text-[13px] leading-snug text-zinc-300">
              We read your
              <br />
              public profile
            </p>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-[#1c2128] p-4 text-center">
            <div className="mb-3 rounded-md bg-[#2d333b] p-2 text-zinc-400">
              <BarChart2 className="h-4 w-4" />
            </div>
            <p className="text-[13px] leading-snug text-zinc-300">
              We assess your
              <br />
              level automatically
            </p>
          </div>

          <div className="flex flex-col items-center rounded-lg border border-zinc-800 bg-[#1c2128] p-4 text-center">
            <div className="mb-3 rounded-md bg-[#2d333b] p-2 text-green-500/80">
              <Rocket className="h-4 w-4" />
            </div>
            <p className="text-[13px] leading-snug text-zinc-300">
              You get placed
              <br />
              and start immediately
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-center gap-2 border-t border-zinc-800/80 pt-6 text-zinc-500">
          <Lock className="h-3.5 w-3.5" />
          <span className="text-[13px]">We never write to your repos without permission.</span>
        </div>
      </div>
    </div>
  );
}
