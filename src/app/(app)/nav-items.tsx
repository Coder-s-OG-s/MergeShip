'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Folder,
  CheckCircle2,
  GitPullRequest,
  PlayCircle,
  Shield,
  User,
  Trophy,
  Inbox,
  Activity,
  Settings,
} from 'lucide-react';
import { isActiveRoute } from '@/lib/nav-utils';

const CORE_NAV = [
  { name: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
  { name: 'REPOSITORIES', href: '/repositories', icon: Folder },
  { name: 'ISSUES', href: '/issues', icon: CheckCircle2 },
  { name: 'PULL REQUESTS', href: '/my-prs', icon: GitPullRequest },
  { name: 'PIPELINES', href: '/pipelines', icon: PlayCircle },
  { name: 'SECURITY', href: '/security', icon: Shield },
];

export function NavItems({
  profileHref,
  level,
  isMaintainer,
}: {
  profileHref: string;
  level: number;
  isMaintainer: boolean;
}) {
  const pathname = usePathname();

  const items = [
    ...CORE_NAV,
    ...(level >= 2 ? [{ name: 'HELP INBOX', href: '/help-inbox', icon: Inbox }] : []),
    ...(isMaintainer ? [{ name: 'MAINTAINER', href: '/maintainer', icon: Shield }] : []),
    { name: 'PROFILE', href: profileHref, icon: User },
    { name: 'LEADERBOARD', href: '/leaderboard', icon: Trophy },
    { name: 'SETTINGS', href: '/settings/profile', icon: Settings },
    { name: 'USAGE', href: '/settings/usage', icon: Activity },
  ];

  return (
    <>
      {items.map((item) => {
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
    </>
  );
}
