'use client';

import Link from 'next/link';
import { Github, ExternalLink } from 'lucide-react';

type Props = {
  githubHandle: string;
  xp: number;
  level: number;
  trustScore?: number;
};

const LEVEL_TITLES: Record<number, string> = {
  0: 'NEWCOMER',
  1: 'CONTRIBUTOR',
  2: 'CONTRIBUTOR',
  3: 'SENIOR CONTRIBUTOR',
  4: 'MAINTAINER',
  5: 'CORE MAINTAINER',
};

function getLevelTitle(level: number): string {
  return LEVEL_TITLES[level] ?? 'CONTRIBUTOR';
}

export function ProfileSidebar({ githubHandle, xp, level, trustScore = 0 }: Props) {
  const initials = githubHandle.slice(0, 2).toUpperCase();
  const title = getLevelTitle(level);

  return (
    <aside className="space-y-6">
      {/* Avatar + Identity */}
      <div className="border border-zinc-800 bg-[#000E12] p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="flex h-14 w-14 items-center justify-center border border-[#00FF87]/40 bg-[#0d2818] font-serif text-xl text-[#00FF87]">
            {initials}
          </div>
          <div>
            <div className="font-serif text-lg text-white">{githubHandle}</div>
            <Link
              href={`https://github.com/${githubHandle}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500 transition-colors hover:text-zinc-300"
            >
              <Github className="h-3 w-3" />
              GITHUB
              <ExternalLink className="h-2.5 w-2.5" />
            </Link>
          </div>
        </div>

        {/* Badges */}
        <div className="flex flex-wrap gap-2">
          <span className="border border-[#00FF87]/50 bg-[#10b981]/10 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#00FF87]">
            L{level} {title}
          </span>
          <span className="border border-purple-700/50 bg-purple-900/20 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300">
            TRUST {trustScore}
          </span>
        </div>
      </div>

      {/* XP Summary */}
      <div className="border border-zinc-800 bg-[#000E12] p-5">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">
          TOTAL XP EARNED
        </div>
        <div className="font-serif text-3xl text-white">{xp.toLocaleString()}</div>
        <div className="mt-1 text-[10px] uppercase tracking-widest text-zinc-600">XP POINTS</div>
      </div>

      {/* Quick Links */}
      <div className="border border-zinc-800 bg-[#000E12] p-5">
        <div className="mb-3 text-[10px] uppercase tracking-widest text-zinc-500">QUICK LINKS</div>
        <div className="space-y-2">
          {[
            { label: 'MY PULL REQUESTS', href: '/my-prs' },
            { label: 'BROWSE ISSUES', href: '/issues' },
            { label: 'LEADERBOARD', href: '/leaderboard' },
            { label: 'SETTINGS', href: '/settings/profile' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between border-b border-zinc-800 pb-2 text-[10px] uppercase tracking-widest text-zinc-400 transition-colors last:border-0 last:pb-0 hover:text-white"
            >
              {link.label}
              <span className="text-zinc-700">→</span>
            </Link>
          ))}
        </div>
      </div>
    </aside>
  );
}

export function ProfileSidebarSkeleton() {
  return (
    <aside className="space-y-6">
      <div className="border border-zinc-800 bg-[#000E12] p-5">
        <div className="mb-4 flex items-center gap-4">
          <div className="h-14 w-14 animate-pulse bg-zinc-800" />
          <div className="space-y-2">
            <div className="h-5 w-28 animate-pulse bg-zinc-800" />
            <div className="h-3 w-16 animate-pulse bg-zinc-800" />
          </div>
        </div>
        <div className="flex gap-2">
          <div className="h-5 w-24 animate-pulse bg-zinc-800" />
          <div className="h-5 w-16 animate-pulse bg-zinc-800" />
        </div>
      </div>
      <div className="border border-zinc-800 bg-[#000E12] p-5">
        <div className="mb-3 h-3 w-24 animate-pulse bg-zinc-800" />
        <div className="h-8 w-20 animate-pulse bg-zinc-800" />
      </div>
    </aside>
  );
}
