'use client';

import { useState, useTransition } from 'react';
import { resendInvite, type InviteRow } from '@/app/actions/maintainer';

function ResendButton({ inviteId }: { inviteId: string }) {
  const [isPending, startTransition] = useTransition();
  const [sent, setSent] = useState(false);

  function handleResend() {
    startTransition(async () => {
      const res = await resendInvite(inviteId);
      if (res.ok) {
        setSent(true);
        setTimeout(() => setSent(false), 2000);
      }
    });
  }

  if (sent) {
    return <span className="text-xs font-medium text-emerald-500">Sent!</span>;
  }

  return (
    <button
      type="button"
      onClick={handleResend}
      disabled={isPending}
      className="text-xs font-medium text-zinc-400 hover:text-zinc-200 disabled:opacity-50"
    >
      {isPending ? 'Sending...' : 'Resend'}
    </button>
  );
}

export function PendingInvitesPanel({
  invites,
  installationId,
}: {
  invites: InviteRow[];
  installationId: number;
}) {
  return (
    <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
      <h3 className="flex items-center gap-2 text-sm font-semibold text-zinc-200">
        <span role="img" aria-label="clock">
          ⏰
        </span>
        Pending Invites
      </h3>

      <div className="mt-4 flex flex-col gap-3">
        {invites.length === 0 ? (
          <p className="text-sm text-zinc-500">No pending invites</p>
        ) : (
          invites.map((invite) => (
            <div key={invite.id} className="flex items-center justify-between gap-3">
              <span className="min-w-0 flex-1 truncate text-sm text-zinc-400">{invite.email}</span>
              <ResendButton inviteId={invite.id} />
            </div>
          ))
        )}
      </div>
    </div>
  );
}
