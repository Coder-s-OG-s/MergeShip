'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  GitPullRequest,
  AlertCircle,
  Users,
  GraduationCap,
  MessageSquare,
  BarChart3,
  Settings,
} from 'lucide-react';

const NAV = [
  { name: 'Dashboard', href: '/maintainer', icon: LayoutDashboard, exact: true },
  { name: 'PR Queue', href: '/maintainer/pr-queue', icon: GitPullRequest },
  { name: 'Issues', href: '/maintainer/issues', icon: AlertCircle },
  { name: 'Contributors', href: '/maintainer/contributors', icon: Users },
  { name: 'Mentors', href: '/maintainer/mentors', icon: GraduationCap },
  { name: 'Communications', href: '/maintainer/communications', icon: MessageSquare },
  { name: 'Analytics', href: '/maintainer/analytics', icon: BarChart3 },
  { name: 'Settings', href: '/maintainer/settings', icon: Settings },
];

export function MaintainerNav() {
  const pathname = usePathname();
  return (
    <>
      {NAV.map((item) => {
        const Icon = item.icon;
        const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`mb-0.5 flex items-center gap-3 rounded-md px-3 py-2.5 text-[12px] tracking-wider transition-colors ${
              isActive
                ? 'border-l-2 border-[#00d26a] bg-[#161b22] pl-[10px] text-white'
                : 'text-[#8b949e] hover:bg-[#161b22]/60 hover:text-white'
            }`}
          >
            <Icon className="h-4 w-4 shrink-0" />
            {item.name}
          </Link>
        );
      })}
    </>
  );
}
