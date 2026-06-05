import Link from 'next/link';
import { Anchor } from 'lucide-react';
import { CommandPalette } from '@/components/command-palette';
import { LogoutButton } from './logout-button';

const NAV_LINKS = [
  { label: 'Dashboard', href: '/dashboard' },
  { label: 'Issues', href: '/issues' },
  { label: 'My PRs', href: '/my-prs' },
  { label: 'Leaderboard', href: '/leaderboard' },
];

export function AppNavbar({ handle }: { handle: string | null }) {
  return (
    <header className="app-navbar shrink-0">
      <div className="app-navbar-left">
        <Link href="/dashboard" className="app-navbar-logo">
          <Anchor className="h-[22px] w-[22px] shrink-0 text-[#111110]" strokeWidth={1.6} />
          <span className="app-navbar-wordmark">MergeShip</span>
        </Link>
        <nav className="app-navbar-links hidden lg:flex" aria-label="Primary">
          {NAV_LINKS.map((link) => (
            <Link key={link.href} href={link.href} className="app-navbar-link">
              {link.label}
            </Link>
          ))}
        </nav>
      </div>

      <div className="app-navbar-right">
        <div className="hidden w-44 sm:block">
          <CommandPalette variant="navbar" />
        </div>
        {handle && <span className="app-navbar-user hidden truncate sm:inline">{handle}</span>}
        <LogoutButton variant="navbar" />
      </div>
    </header>
  );
}
