'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  ListChecks,
  Users2,
  Settings,
  Activity,
  ArrowLeftRight,
} from 'lucide-react';
import { isActiveRoute } from '@/lib/nav-utils';

const MAINTAINER_NAV = [
  { name: 'OVERVIEW', href: '/maintainer', icon: LayoutDashboard },
  { name: 'ISSUE TRIAGE', href: '/maintainer/issues', icon: ListChecks },
  { name: 'COMMUNITY', href: '/maintainer/community', icon: Users2 },
  { name: 'SETTINGS', href: '/settings/profile', icon: Settings },
  { name: 'USAGE', href: '/settings/usage', icon: Activity },
];

export function MaintainerNavItems() {
  const pathname = usePathname();

  return (
    <>
      {MAINTAINER_NAV.map((item) => {
        const Icon = item.icon;
        const isActive = isActiveRoute(item.href, pathname);

        return (
          <Link
            key={item.name}
            href={item.href}
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
