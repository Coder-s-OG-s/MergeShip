'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserSupabase } from '@/lib/supabase/browser';

type Persona = {
  email: string;
  level: string;
  label: string;
  blurb: string;
};

const DEV_PASSWORD = 'dev-password-only';

export default function DevLoginButtons({ personas }: { personas: Persona[] }) {
  const router = useRouter();
  const [pending, setPending] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function signInAs(persona: Persona) {
    setPending(persona.email);
    setError(null);
    const sb = getBrowserSupabase();
    if (!sb) {
      setError('Supabase env not configured');
      setPending(null);
      return;
    }
    const { error: signInErr } = await sb.auth.signInWithPassword({
      email: persona.email,
      password: DEV_PASSWORD,
    });
    if (signInErr) {
      setError(`${persona.label}: ${signInErr.message}`);
      setPending(null);
      return;
    }
    router.refresh();
    router.push('/dashboard');
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {personas.map((p) => (
        <button
          key={p.email}
          onClick={() => signInAs(p)}
          disabled={pending !== null}
          className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 text-left transition hover:border-zinc-600 disabled:opacity-50"
        >
          <div className="mb-1 flex items-baseline justify-between">
            <span className="font-display text-lg font-semibold">{p.label}</span>
            <span className="text-xs text-zinc-500">{p.level}</span>
          </div>
          <p className="text-sm text-zinc-400">{p.blurb}</p>
          {pending === p.email && <p className="mt-2 text-xs text-zinc-500">Signing in…</p>}
        </button>
      ))}
      {error && <p className="col-span-full text-sm text-red-400">{error}</p>}
    </div>
  );
}
