'use client';

import { useState, useTransition, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { sendInvite, getMyGithubHandle } from '@/app/actions/maintainer';
import { captureEvent } from '@/lib/posthog/helpers';
import { EVENTS } from '@/lib/posthog/events';
import { Check, Link } from 'lucide-react';

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
  const [linkCopied, setLinkCopied] = useState(false);
  const [generatingLink, setGeneratingLink] = useState(false);
  const router = useRouter();

  const handleClose = () => {
    setOpen(false);
    setError(null);
    setEmail('');
    setLinkCopied(false);
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        handleClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [open]);

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
        captureEvent(EVENTS.MAINTAINER_INVITE_SENT, { installationId, accountLogin });
      } else {
        setError(res.error.message || 'Failed to send invite');
      }
    });
  }

  async function handleCopyLink() {
    setGeneratingLink(true);
    const res = await getMyGithubHandle();
    if (!res.ok) {
      setError(res.error.message || 'Failed to generate invite link');
      setGeneratingLink(false);
      return;
    }
    const link = `${process.env.NEXT_PUBLIC_APP_URL || 'https://mergeship.dev'}/invite?ref=${res.data}`;

    try {
      await navigator.clipboard.writeText(link);
      setLinkCopied(true);
    } catch {
      setError('Failed to copy to clipboard. Please try again.');
    } finally {
      setGeneratingLink(false);
      setTimeout(() => {
        setLinkCopied(false);
        setError(null);
      }, 2000);
    }
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
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
          onClick={handleClose}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-zinc-800 bg-zinc-900 p-6"
            onClick={(e) => e.stopPropagation()}
          >
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

            <div className="mt-5 flex items-center gap-3">
              <span className="h-px flex-1 bg-zinc-800" />
              <span className="text-xs text-zinc-600">or</span>
              <span className="h-px flex-1 bg-zinc-800" />
            </div>

            <button
              type="button"
              onClick={handleCopyLink}
              disabled={generatingLink}
              className="mt-4 flex w-full items-center justify-center gap-2 rounded-lg border border-zinc-700 px-3 py-2 text-sm text-zinc-300 hover:border-zinc-600 disabled:opacity-50"
            >
              {linkCopied ? (
                <Check className="h-4 w-4 text-emerald-500" />
              ) : (
                <Link className="h-4 w-4" />
              )}
              {linkCopied ? 'Link copied!' : generatingLink ? 'Generating...' : 'Copy invite link'}
            </button>

            <button
              type="button"
              onClick={handleClose}
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
