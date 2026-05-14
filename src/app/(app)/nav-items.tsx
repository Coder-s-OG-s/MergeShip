'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  CheckCircle2,
  GitPullRequest,
  Users,
  MessageSquare,
  User,
  Trophy,
} from 'lucide-react';

const STATIC_NAV = [
  { name: 'DASHBOARD', href: '/dashboard', icon: LayoutDashboard },
  { name: 'ISSUES', href: '/issues', icon: CheckCircle2 },
  { name: 'MY PRS', href: '/my-prs', icon: GitPullRequest },
  { name: 'MENTORSHIP', href: '#', icon: Users },
  { name: 'COMMUNITY', href: '#', icon: MessageSquare },
];

export function NavItems({ profileHref }: { profileHref: string }) {
  const pathname = usePathname();
  const items = [
    ...STATIC_NAV,
    { name: 'PROFILE', href: profileHref, icon: User },
    { name: 'LEADERBOARD', href: '/leaderboard', icon: Trophy },
  ];

  return (
    <>
      {items.map((item) => {
        const Icon = item.icon;
        const isActive = item.href !== '#' && pathname.startsWith(item.href);
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
