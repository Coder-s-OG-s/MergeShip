'use client';

import { LogOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export function LogoutButton({ variant = 'sidebar' }: { variant?: 'sidebar' | 'navbar' }) {
  const router = useRouter();

  async function handleLogout() {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await sb.auth.signOut();
    router.push('/');
  }

  if (variant === 'navbar') {
    return (
      <button type="button" onClick={handleLogout} className="app-navbar-btn">
        Sign out →
      </button>
    );
  }

  return (
    <button type="button" onClick={handleLogout} className="app-sidebar-action">
      <LogOut strokeWidth={1.75} />
      Sign out
    </button>
  );
}
