'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvite } from '@/app/actions/maintainer';

export default function InviteContributorButton({
  installationId,
  accountLogin,
}: {
  installationId: number;
  accountLogin: string;
}) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address');
      return;
    }

    startTransition(async () => {
      const res = await sendInvite(installationId, email);
      if (res.ok) {
        setEmail('');
        setOpen(false);
        router.refresh();
      } else {
        setError(res.error.message || 'Failed to send invite');
      }
    });
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="rounded-lg border border-zinc-700 px-3 py-1.5 text-sm text-zinc-300 hover:border-zinc-600"
      >
        Invite contributor
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
            <h2 className="mb-2 text-lg font-semibold text-white">Invite a contributor</h2>
            <p className="mb-4 text-sm text-zinc-400">
              Send an email invite to join {accountLogin} on MergeShip.
            </p>

            <form onSubmit={handleSubmit} className="flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-300 placeholder:text-zinc-600 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  disabled={isPending}
                  required
                />
                <button
                  type="submit"
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-500 disabled:opacity-50"
                >
                  {isPending ? 'Sending...' : 'Send'}
                </button>
              </div>
              {error && <p className="text-sm text-red-400">{error}</p>}
            </form>

            <button
              type="button"
              onClick={() => {
                setOpen(false);
                setError(null);
                setEmail('');
              }}
              className="mt-5 text-sm text-zinc-500 hover:text-zinc-300"
            >
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
