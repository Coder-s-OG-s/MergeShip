'use client';

import { useState, useRef, useEffect } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  Users2,
  Users,
  Settings,
  Activity,
  ArrowLeftRight,
  ChevronDown,
  Building2,
  User,
} from 'lucide-react';
import { isActiveRoute } from '@/lib/nav-utils';
import type { MaintainerInstall } from '@/lib/maintainer/detect';

const MAINTAINER_NAV = [
  { name: 'OVERVIEW', href: '/maintainer', icon: LayoutDashboard },
  { name: 'ISSUE TRIAGE', href: '/maintainer/issues', icon: ListChecks },
  { name: 'CONTRIBUTORS', href: '/maintainer/contributors', icon: Users },
  { name: 'COMMUNITY', href: '/maintainer/community', icon: Users2 },
  { name: 'SETTINGS', href: '/settings/profile', icon: Settings },
  { name: 'USAGE', href: '/settings/usage', icon: Activity },
];

export function MaintainerNavItems({ installs = [] }: { installs?: MaintainerInstall[] }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const installParam = searchParams.get('install');
  const activeInstall =
    installs.length > 0
      ? installs.find((i) => i.installationId === Number(installParam)) || installs[0]
      : undefined;

  const getInstallHref = (id: number) => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('install', String(id));
    params.delete('state');
    params.delete('verified');
    params.delete('bucket');
    return `${pathname}?${params.toString()}`;
  };

  return (
    <>
      {/* Organization Switcher Dropdown */}
      {installs.length > 0 &&
        activeInstall &&
        (installs.length === 1 ? (
          <div className="mb-4 flex items-center gap-3 rounded-md border border-[#2d333b] bg-[#161b22]/40 px-4 py-3 text-[13px] text-zinc-300">
            {activeInstall.accountType === 'Organization' ? (
              <Building2 className="h-4 w-4 shrink-0 text-zinc-500" />
            ) : (
              <User className="h-4 w-4 shrink-0 text-zinc-500" />
            )}
            <span className="truncate font-medium">{activeInstall.accountLogin}</span>
          </div>
        ) : (
          <div className="relative mb-4" ref={dropdownRef}>
            <button
              type="button"
              onClick={() => setIsOpen(!isOpen)}
              className="flex w-full items-center justify-between gap-3 rounded-md border border-[#2d333b] bg-[#161b22] px-4 py-3 text-[13px] text-white transition-colors hover:bg-[#161b22]/80"
            >
              <div className="flex items-center gap-3 truncate">
                {activeInstall.accountType === 'Organization' ? (
                  <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                ) : (
                  <User className="h-4 w-4 shrink-0 text-zinc-400" />
                )}
                <span className="truncate font-medium">{activeInstall.accountLogin}</span>
              </div>
              <ChevronDown
                className={`h-4 w-4 shrink-0 text-zinc-400 transition-transform duration-200 ${
                  isOpen ? 'rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div className="absolute left-0 right-0 z-50 mt-1 max-h-60 overflow-y-auto rounded-md border border-[#2d333b] bg-[#111318] py-1 shadow-lg">
                {installs.map((inst) => {
                  const isSelected = inst.installationId === activeInstall.installationId;
                  return (
                    <Link
                      key={inst.installationId}
                      href={getInstallHref(inst.installationId)}
                      onClick={() => setIsOpen(false)}
                      className={`flex items-center gap-3 px-4 py-2.5 text-[13px] transition-colors ${
                        isSelected
                          ? 'bg-[#161b22] font-medium text-white'
                          : 'text-zinc-400 hover:bg-[#161b22]/50 hover:text-white'
                      }`}
                    >
                      {inst.accountType === 'Organization' ? (
                        <Building2 className="h-4 w-4 shrink-0 text-zinc-400" />
                      ) : (
                        <User className="h-4 w-4 shrink-0 text-zinc-400" />
                      )}
                      <span className="flex-1 truncate">{inst.accountLogin}</span>
                      {isSelected && <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        ))}

      {/* Nav Items */}
      {MAINTAINER_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(item.href, pathname);
        const href =
          item.href.startsWith('/maintainer') && activeInstall
            ? `${item.href}?install=${activeInstall.installationId}`
            : item.href;

        return (
          <Link
            key={item.name}
            href={href}
            className={`flex items-center gap-4 rounded-md px-4 py-3 text-[13px] tracking-widest transition-colors ${
              isActive
                ? 'bg-[#161b22] text-white'
                : 'text-zinc-400 hover:bg-[#161b22]/50 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4" />
            {item.name}
          </Link>
        );
      })}

      <Link
        href="/dashboard"
        className="mt-2 flex items-center gap-4 rounded-md px-4 py-3 text-[13px] tracking-widest text-zinc-500 transition-colors hover:bg-[#161b22]/50 hover:text-white"
      >
        <ArrowLeftRight className="h-4 w-4" />
        CONTRIBUTOR VIEW
      </Link>
    </>
  );
}
