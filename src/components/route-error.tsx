'use client';

import { useEffect } from 'react';
import { captureException } from '@/lib/posthog/helpers';

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Shared UI for Next.js error boundaries (`error.tsx`).
 *
 * Every route-level boundary renders this so error reporting and the themed
 * fallback live in one place. The raw message/digest surface only in
 * development; in production users see a generic message while the details go
 * to PostHog. `digest` is Next.js's server-error correlation id — forwarding it
 * lets us tie a client report back to the server log.
 */
export function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    captureException(error, { digest: error.digest });
  }, [error]);

  const isDev = process.env.NODE_ENV === 'development';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-[#111318] px-6 text-white">
      <div className="w-full max-w-md border border-[#2d333b] bg-[#161b22] p-10 text-center">
        <div className="mb-3 text-[11px] uppercase tracking-[0.3em] text-zinc-500">
          System Error
        </div>

        <h1 className="mb-4 font-serif text-3xl">Something went wrong.</h1>

        <p className="mb-8 text-sm leading-6 text-zinc-400">
          An unexpected error occurred while loading this page.
        </p>

        {isDev && (
          <div className="mb-8 break-words border border-[#2d333b] bg-[#0d1117] p-4 text-left text-xs leading-5 text-rose-300">
            <p className="font-mono">{error.message}</p>
            {error.digest && <p className="mt-2 text-zinc-500">digest: {error.digest}</p>}
          </div>
        )}

        <button
          onClick={() => reset()}
          className="border border-zinc-700 px-6 py-3 text-[11px] uppercase tracking-[0.25em] text-zinc-300 transition hover:bg-zinc-800 hover:text-white"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
