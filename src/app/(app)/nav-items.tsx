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
} from 'lucide-react';
import { isActiveRoute } from '@/lib/nav-utils';

const CORE_NAV = [
  { name: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
  { name: 'Issues', href: '/issues', icon: CheckCircle2 },
  { name: 'My PRs', href: '/my-prs', icon: GitPullRequest },
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
    ...(level >= 2 ? [{ name: 'Help Inbox', href: '/help-inbox', icon: Inbox }] : []),
    ...(isMaintainer ? [{ name: 'Maintainer', href: '/maintainer', icon: Shield }] : []),
    { name: 'Profile', href: profileHref, icon: User },
    { name: 'Leaderboard', href: '/leaderboard', icon: Trophy },
    { name: 'Settings', href: '/settings/profile', icon: Settings },
    { name: 'Usage', href: '/settings/usage', icon: Activity },
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
            className={`app-nav-item${isActive ? 'app-nav-item--active' : ''}`}
          >
            <Icon strokeWidth={1.75} />
            {item.name}
          </Link>
        );
      })}
    </>
  );
}
