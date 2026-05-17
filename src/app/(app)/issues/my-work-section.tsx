'use client';

import { useState, useTransition } from 'react';
import { ExternalLink, Pencil, X } from 'lucide-react';
import { linkPrToRec, unlinkPrFromRec, unclaimRecommendation } from '@/app/actions/recommendations';
import { MentorVerifyButton } from '../maintainer/mentor-verify-button';

export type LinkedRec = {
  id: number;
  linked_pr_url: string;
  status: string;
  xp_reward: number;
  issue_id: number;
  issue: { title: string; repo_full_name: string; url: string } | null;
  pullRequestId: number | null;
  pullRequestAuthorUserId: string | null;
  mentorVerified: boolean;
};

const STATUS_CLS: Record<string, string> = {
  claimed: 'border-purple-800 text-purple-400',
  completed: 'border-emerald-800 text-emerald-400',
  expired: 'border-zinc-700 text-zinc-500',
  reassigned: 'border-zinc-700 text-zinc-500',
};

export function MyWorkSection({
  initialRecs,
  currentUserId,
  canVerify,
}: {
  initialRecs: LinkedRec[];
  currentUserId: string;
  canVerify: boolean;
}) {
  const [recs, setRecs] = useState(initialRecs);

  function onUnlink(id: number) {
    setRecs((prev) => prev.filter((r) => r.id !== id));
  }

  function onUnclaim(id: number) {
    setRecs((prev) => prev.filter((r) => r.id !== id));
  }

  function onRelinkd(id: number, newUrl: string) {
    setRecs((prev) => prev.map((r) => (r.id === id ? { ...r, linked_pr_url: newUrl } : r)));
  }

  if (recs.length === 0) return null;

  return (
    <section className="mb-16">
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY WORK</h2>
        <span className="text-[11px] uppercase tracking-widest text-zinc-600">PR SUBMITTED</span>
      </div>
      <div>
        {recs.map((rec) => (
          <WorkItem
            key={rec.id}
            rec={rec}
            onUnlink={() => onUnlink(rec.id)}
            onUnclaim={() => onUnclaim(rec.id)}
            onRelink={(url) => onRelinkd(rec.id, url)}
            currentUserId={currentUserId}
            canVerify={canVerify}
          />
        ))}
      </div>
    </section>
  );
}

function WorkItem({
  rec,
  onUnlink,
  onUnclaim,
  onRelink,
  currentUserId,
  canVerify,
}: {
  rec: LinkedRec;
  onUnlink: () => void;
  onUnclaim: () => void;
  onRelink: (url: string) => void;
  currentUserId: string;
  canVerify: boolean;
}) {
  const [editing, setEditing] = useState(false);
  const [editUrl, setEditUrl] = useState(rec.linked_pr_url);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const statusCls = STATUS_CLS[rec.status] ?? 'border-zinc-700 text-zinc-500';

  function handleUnlink() {
    setError(null);
    startTransition(async () => {
      const res = await unlinkPrFromRec(rec.id);
      if (res.ok) onUnlink();
      else setError(res.error.message);
    });
  }

  function handleUnclaim() {
    setError(null);
    startTransition(async () => {
      const res = await unclaimRecommendation(rec.id);
      if (res.ok) onUnclaim();
      else setError(res.error.message);
    });
  }

  function handleSaveEdit() {
    const trimmed = editUrl.trim();
    if (!trimmed) return;
    setError(null);
    startTransition(async () => {
      const res = await linkPrToRec(rec.id, trimmed);
      if (res.ok) {
        onRelink(trimmed);
        setEditing(false);
      } else {
        setError(res.error.message);
      }
    });
  }

  return (
    <div className="border-b border-[#2d333b] py-5 last:border-0">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <span className="text-[10px] uppercase tracking-widest text-zinc-600">
          {rec.issue?.repo_full_name ?? '—'}
        </span>
        <span className={`border px-2 py-0.5 text-[10px] uppercase tracking-widest ${statusCls}`}>
          {rec.status}
        </span>
      </div>

      <div className="mb-3 flex items-start justify-between gap-4">
        <a
          href={rec.issue?.url ?? '#'}
          target="_blank"
          rel="noreferrer"
          className="font-serif text-lg leading-snug text-white hover:text-zinc-300"
        >
          {rec.issue?.title ?? '—'}
        </a>
        <span className="shrink-0 text-[10px] uppercase tracking-widest text-emerald-600">
          +{rec.xp_reward} XP
        </span>
      </div>

      {editing ? (
        <div className="mb-3 flex items-center gap-2">
          <input
            type="url"
            value={editUrl}
            onChange={(e) => setEditUrl(e.target.value)}
            className="min-w-0 flex-1 border border-[#2d333b] bg-[#161b22] px-3 py-1.5 text-[11px] uppercase tracking-widest text-zinc-300 outline-none focus:border-zinc-500"
            autoFocus
          />
          <button
            onClick={handleSaveEdit}
            disabled={pending || !editUrl.trim()}
            className="border border-zinc-600 px-3 py-1.5 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-white hover:text-white disabled:opacity-40"
          >
            {pending ? '...' : 'SAVE'}
          </button>
          <button
            onClick={() => {
              setEditing(false);
              setEditUrl(rec.linked_pr_url);
            }}
            className="text-[10px] uppercase tracking-widest text-zinc-600 hover:text-zinc-400"
          >
            CANCEL
          </button>
        </div>
      ) : (
        <div className="mb-3 flex items-center gap-3">
          <a
            href={rec.linked_pr_url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-zinc-200"
          >
            <ExternalLink className="h-3 w-3" />
            {rec.linked_pr_url.replace('https://github.com/', '')}
          </a>
          <button
            onClick={() => setEditing(true)}
            className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400"
            title="Edit PR link"
          >
            <Pencil className="h-3 w-3" /> EDIT
          </button>
        </div>
      )}

      {error && (
        <div className="mb-2 text-[10px] uppercase tracking-widest text-red-400">{error}</div>
      )}

      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={handleUnlink}
            disabled={pending}
            className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-400 disabled:opacity-40"
          >
            <X className="mr-1 inline h-3 w-3" />
            UNLINK PR
          </button>
          <button
            onClick={handleUnclaim}
            disabled={pending}
            className="text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-red-400 disabled:opacity-40"
          >
            UNCLAIM ISSUE
          </button>
        </div>
        {canVerify &&
          rec.pullRequestId !== null &&
          !rec.mentorVerified &&
          rec.pullRequestAuthorUserId !== currentUserId && (
            <MentorVerifyButton prId={rec.pullRequestId} />
          )}
      </div>
    </div>
  );
}
