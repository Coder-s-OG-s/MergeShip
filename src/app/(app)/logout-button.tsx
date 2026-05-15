'use client';

import { LogOut } from 'lucide-react';
import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    const sb = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    await sb.auth.signOut();
    router.push('/');
  }

  return (
    <button
      onClick={handleLogout}
      className="flex w-full items-center gap-3 text-[13px] tracking-widest text-zinc-400 transition-colors hover:text-white"
    >
      <LogOut className="h-4 w-4" />
      LOGOUT
    </button>
  );
}
