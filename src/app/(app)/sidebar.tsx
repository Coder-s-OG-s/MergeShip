'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavItems } from './nav-items';
import { MaintainerNavItems } from './maintainer-nav-items';
import { CommandPalette } from '@/components/command-palette';
import { ThemeToggle } from './theme-toggle';
import { LogoutButton } from './logout-button';

export function Sidebar({
  handle,
  profileHref,
  level,
  xp,
  githubTotalMerges,
  githubStreak,
  openIssuesCount,
  isMaintainer,
  mentorHandle,
}: {
  handle: string | null;
  profileHref: string;
  level: number;
  xp: number;
  githubTotalMerges: number;
  githubStreak: number;
  openIssuesCount: number;
  isMaintainer: boolean;
  mentorHandle: string | null;
}) {
  const pathname = usePathname();
  const inMaintainerSection = isMaintainer && pathname.startsWith('/maintainer');

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-[#2d333b] bg-[#111318]">
      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="p-8 pb-12">
          <Link href="/" className="font-serif text-2xl font-bold tracking-wider text-white">
            MERGESHIP
          </Link>
        </div>

        <div className="mb-4 px-4">
          <CommandPalette />
        </div>

        <nav className="flex flex-col gap-1 px-4">
          {inMaintainerSection ? (
            <MaintainerNavItems />
          ) : (
            <NavItems profileHref={profileHref} level={level} isMaintainer={isMaintainer} />
          )}
        </nav>

        {!inMaintainerSection && (
          <div className="mx-4 mt-6 grid grid-cols-2 gap-px border border-[#2d333b]">
            <div className="bg-[#161b22] p-3">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">Total XP</div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {xp.toLocaleString()}
              </div>
            </div>
            <div className="bg-[#161b22] p-3">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">Merged PRs</div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {githubTotalMerges.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="bg-[#161b22] p-3">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">Open Issues</div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {openIssuesCount.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="bg-[#161b22] p-3">
              <div className="text-[9px] uppercase tracking-widest text-zinc-500">Streak</div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {githubStreak.toString().padStart(2, '0')}
                <span className="ml-1 text-[9px] text-zinc-500">d</span>
              </div>
            </div>
          </div>
        )}

        {!inMaintainerSection && mentorHandle && (
          <div className="mx-4 mt-4 border border-[#2d333b] p-3">
            <div className="mb-2 text-[9px] uppercase tracking-widest text-zinc-500">
              Assigned Mentor
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-zinc-800 text-[10px] uppercase text-zinc-400">
                {mentorHandle.substring(0, 2).toUpperCase()}
              </div>
              <span className="truncate text-[11px] font-bold uppercase tracking-widest text-zinc-200">
                {mentorHandle}
              </span>
            </div>
            <Link
              href="/help-inbox"
              className="flex w-full items-center justify-center border border-[#10b981] px-3 py-1.5 text-[10px] uppercase tracking-widest text-[#10b981] transition-colors hover:bg-[#10b981]/10"
            >
              Open Chat
            </Link>
          </div>
        )}
      </div>

      <div className="border-t border-[#2d333b] p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-zinc-800">
            <div className="flex h-full w-full items-center justify-center bg-zinc-700 text-xs">
              {handle?.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="truncate text-[13px] font-bold uppercase">
              {handle || 'CONTRIBUTOR'}
            </div>
            <div className="truncate text-[11px] tracking-wider text-zinc-500">
              {inMaintainerSection ? 'MAINTAINER' : `L${level} PRACTITIONER`}
            </div>
          </div>
        </div>
        <ThemeToggle />
        <LogoutButton />
      </div>
    </aside>
  );
}
