'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NavItems } from './nav-items';
import { MaintainerNavItems } from './maintainer-nav-items';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
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
  installs = [],
  unreadCount = 0,
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
  installs?: MaintainerInstall[];
  unreadCount?: number;
}) {
  const pathname = usePathname();
  const inMaintainerSection = isMaintainer && pathname.startsWith('/maintainer');

  return (
    <aside className="flex w-64 shrink-0 flex-col justify-between border-r border-shell-border bg-shell-bg">
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
            <MaintainerNavItems installs={installs} />
          ) : (
            <NavItems
              profileHref={profileHref}
              level={level}
              isMaintainer={isMaintainer}
              unreadCount={unreadCount}
            />
          )}
        </nav>

        {!inMaintainerSection && (
          <div className="mx-4 mt-6 grid grid-cols-2 gap-px border border-shell-border">
            <div className="bg-shell-card-bg p-3">
              <div className="text-[9px] uppercase tracking-widest text-shell-text-muted">
                Total XP
              </div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {xp.toLocaleString()}
              </div>
            </div>
            <div className="bg-shell-card-bg p-3">
              <div className="text-[9px] uppercase tracking-widest text-shell-text-muted">
                Merged PRs
              </div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {githubTotalMerges.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="bg-shell-card-bg p-3">
              <div className="text-[9px] uppercase tracking-widest text-shell-text-muted">
                Open Issues
              </div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {openIssuesCount.toString().padStart(2, '0')}
              </div>
            </div>
            <div className="bg-shell-card-bg p-3">
              <div className="text-[9px] uppercase tracking-widest text-shell-text-muted">
                Streak
              </div>
              <div className="mt-1 font-serif text-lg leading-none text-white">
                {githubStreak.toString().padStart(2, '0')}
                <span className="ml-1 text-[9px] text-shell-text-muted">d</span>
              </div>
            </div>
          </div>
        )}

        {!inMaintainerSection && mentorHandle && (
          <div className="mx-4 mt-4 border border-shell-border p-3">
            <div className="mb-2 text-[9px] uppercase tracking-widest text-shell-text-muted">
              Assigned Mentor
            </div>
            <div className="mb-3 flex items-center gap-2">
              <div className="flex h-7 w-7 shrink-0 items-center justify-center bg-shell-bg-secondary text-[10px] uppercase text-shell-text-muted">
                {mentorHandle.substring(0, 2).toUpperCase()}
              </div>
              <span className="truncate text-[11px] font-bold uppercase tracking-widest text-white">
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

      <div className="border-t border-shell-border p-6">
        <div className="mb-6 flex items-center gap-3">
          <div className="h-10 w-10 shrink-0 overflow-hidden rounded-sm bg-shell-bg-secondary">
            <div className="flex h-full w-full items-center justify-center bg-shell-bg-tertiary text-xs">
              {handle?.substring(0, 2).toUpperCase()}
            </div>
          </div>
          <div className="overflow-hidden">
            <div className="truncate text-[13px] font-bold uppercase">
              {handle || 'CONTRIBUTOR'}
            </div>
            <div className="truncate text-[11px] tracking-wider text-shell-text-muted">
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
