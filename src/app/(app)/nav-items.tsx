'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckCircle2,
  GitPullRequest,
  User,
  Trophy,
  Inbox,
  Shield,
  Activity,
  Settings,
  Bell,
} from 'lucide-react';
import { isActiveRoute } from '@/lib/nav-utils';

const CORE_NAV = [
  { name: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
  { name: 'ISSUES', href: '/issues', icon: CheckCircle2 },
  { name: 'MY PRS', href: '/my-prs', icon: GitPullRequest },
];

export function NavItems({
  profileHref,
  level,
  isMaintainer,
  unreadCount = 0,
}: {
  profileHref: string;
  level: number;
  isMaintainer: boolean;
  unreadCount?: number;
}) {
  const pathname = usePathname();

  const items = [
    ...CORE_NAV,
    { name: 'NOTIFICATIONS', href: '/notifications', icon: Bell, badge: unreadCount },
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
            {'badge' in item && item.badge ? (
              <span className="ml-auto rounded-full bg-[#00FF87] px-1.5 py-0.5 text-[10px] font-bold text-[#000E12]">
                {item.badge > 9 ? '9+' : item.badge}
              </span>
            ) : null}
          </Link>
        );
      })}
    </>
  );
}
