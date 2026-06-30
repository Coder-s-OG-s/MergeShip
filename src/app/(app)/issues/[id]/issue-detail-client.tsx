'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import Link from 'next/link';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Settings,
  BookOpen,
  Activity,
  Clock,
  Zap,
  MessageCircle,
  CheckCircle2,
  Loader2,
  ChevronDown,
  Code2,
  Plus,
  Minus,
} from 'lucide-react';
import type { IssueDetail } from '@/app/actions/issues';
import { claimIssue, unclaimIssue } from '@/app/actions/issues';

const DIFFICULTY_BADGE: Record<string, { label: string; color: string }> = {
  E: { label: 'EASY', color: 'border-emerald-700 text-emerald-400 bg-emerald-950/20' },
  M: { label: 'MEDIUM', color: 'border-yellow-700 text-yellow-400 bg-yellow-950/20' },
  H: { label: 'HARD', color: 'border-red-800 text-red-400 bg-red-950/20' },
};

interface Props {
  issue: IssueDetail;
  currentUserLevel: number;
  currentUserHandle: string | null;
  currentUserAvatar: string | null;
}

export function IssueDetailClient({
  issue,
  currentUserLevel,
  currentUserHandle,
  currentUserAvatar,
}: Props) {
  const router = useRouter();
  const [claimPending, setClaimPending] = useState(false);
  const [claimResult, setClaimResult] = useState<'idle' | 'claimed' | 'error'>('idle');
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [branchName, setBranchName] = useState('');

  const isClaimed = issue.userRecStatus === 'claimed';
  const repoName = issue.repoFullName.split('/')[1] ?? issue.repoFullName;
  const org = issue.repoFullName.split('/')[0] ?? '';
  const difficultyBadge = DIFFICULTY_BADGE[issue.difficulty ?? ''] ?? null;

  const handleClaim = async () => {
    setClaimPending(true);
    try {
      const res = await claimIssue(issue.id);
      if (res.ok) {
        setClaimResult('claimed');
        router.refresh();
      } else {
        setClaimResult('error');
      }
    } catch {
      setClaimResult('error');
    } finally {
      setClaimPending(false);
    }
  };

  const handleUnclaim = async () => {
    if (!issue.userRecId) return;
    setClaimPending(true);
    try {
      await unclaimIssue(issue.userRecId);
      setClaimResult('idle');
      router.refresh();
    } catch {
      setClaimResult('error');
    } finally {
      setClaimPending(false);
    }
  };

  const handleCreateBranch = () => {
    const defaultBranch = `fix/${issue.githubIssueNumber}-${issue.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '')
      .slice(0, 50)}`;
    setBranchName(defaultBranch);
    setShowBranchModal(true);
  };

  const confirmBranch = () => {
    setShowBranchModal(false);
  };

  const timeAgo = (dateStr: string) => {
    const diff = Date.now() - new Date(dateStr).getTime();
    const days = Math.floor(diff / 86400000);
    if (days === 0) return 'today';
    if (days === 1) return 'yesterday';
    if (days < 30) return `${days}d ago`;
    return `${Math.floor(days / 30)}mo ago`;
  };

  const formatXp = (xp: number) => `+${xp} XP`;

  return (
    <div className="min-h-screen bg-[#0D0E12] font-mono text-white">
      <div className="mx-auto flex max-w-7xl">
        {/* Left Action Sidebar */}
        <aside className="hidden w-16 shrink-0 flex-col items-center gap-6 border-r border-zinc-800 py-8 lg:flex">
          <button
            onClick={handleCreateBranch}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#00FF87] text-black transition-colors hover:bg-[#00CC6A]"
            title="New Branch"
          >
            <GitBranch className="h-4 w-4" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            title="Settings"
          >
            <Settings className="h-4 w-4" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            title="Documentation"
          >
            <BookOpen className="h-4 w-4" />
          </button>
          <button
            className="flex h-10 w-10 items-center justify-center rounded-xl border border-zinc-800 text-zinc-500 transition-colors hover:border-zinc-600 hover:text-zinc-300"
            title="System Status"
          >
            <Activity className="h-4 w-4" />
          </button>
        </aside>

        {/* Main Content */}
        <div className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-4xl px-6 py-10">
            {/* Breadcrumbs */}
            <div className="mb-6 flex items-center gap-3 text-sm">
              <button
                onClick={() => router.push('/issues')}
                className="flex items-center gap-1.5 text-zinc-500 transition-colors hover:text-zinc-300"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Issues
              </button>
              <span className="text-zinc-700">/</span>
              <Link
                href={`/issues?repo=${encodeURIComponent(issue.repoFullName)}`}
                className="text-zinc-400 hover:text-zinc-300"
              >
                {org}/{repoName}
              </Link>
              <span className="text-zinc-700">/</span>
              <span className="text-zinc-300">#{issue.githubIssueNumber}</span>
            </div>

            {/* Metadata Header Card */}
            <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
              <div className="mb-4 flex items-center gap-3">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                    issue.state === 'open'
                      ? 'border-emerald-700 bg-emerald-950/20 text-emerald-400'
                      : 'border-zinc-600 bg-zinc-800/50 text-zinc-400'
                  }`}
                >
                  {issue.state === 'open' ? 'OPEN' : 'CLOSED'}
                </span>
                {difficultyBadge && (
                  <span
                    className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${difficultyBadge.color}`}
                  >
                    {difficultyBadge.label}
                  </span>
                )}
                {issue.xpReward && (
                  <span className="inline-flex items-center gap-1 rounded-full bg-[#00FF87]/10 px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00FF87]">
                    <Zap className="h-3 w-3" />
                    {formatXp(issue.xpReward)}
                  </span>
                )}
              </div>

              <h1 className="mb-4 font-display text-2xl font-bold leading-tight text-white">
                {issue.title}
              </h1>

              <div className="flex items-center gap-4 text-xs text-zinc-500">
                <div className="flex items-center gap-2">
                  {issue.authorAvatar ? (
                    <Image
                      src={issue.authorAvatar}
                      alt=""
                      width={20}
                      height={20}
                      className="h-5 w-5 rounded-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <div className="flex h-5 w-5 items-center justify-center rounded-full bg-zinc-800 text-[8px] text-zinc-500">
                      {issue.authorHandle.substring(0, 2).toUpperCase()}
                    </div>
                  )}
                  <span className="text-zinc-400">{issue.authorHandle}</span>
                </div>
                <span>opened {timeAgo(issue.createdAt)}</span>
                <a
                  href={issue.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-zinc-500 transition-colors hover:text-zinc-300"
                >
                  <ExternalLink className="h-3 w-3" />
                  View on GitHub
                </a>
              </div>
            </div>

            {/* Body / Description */}
            {issue.body && (
              <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50 p-6">
                <div className="prose prose-invert max-w-none">
                  {issue.body.split('\n').map((line, i) => (
                    <p key={i} className="mb-2 text-sm leading-relaxed text-zinc-300">
                      {line || '\u00A0'}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Code Context Widget */}
            <div className="mb-8 rounded-xl border border-zinc-800 bg-zinc-900/50">
              <div className="flex items-center gap-2 border-b border-zinc-800 px-5 py-3">
                <Code2 className="h-4 w-4 text-zinc-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Code Context
                </span>
              </div>
              <div className="p-5">
                <div className="mb-3 flex items-center gap-2">
                  <span className="rounded bg-zinc-800 px-2 py-1 font-mono text-[11px] text-zinc-400">
                    src/lib/runner/cleanup.go
                  </span>
                </div>
                <div className="overflow-hidden rounded-lg border border-zinc-800">
                  <div className="flex border-b border-zinc-800">
                    <div className="flex-1 border-r border-zinc-800 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-red-400">
                      <Minus className="mr-1 inline h-3 w-3" />
                      Current
                    </div>
                    <div className="flex-1 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-emerald-400">
                      <Plus className="mr-1 inline h-3 w-3" />
                      Proposed
                    </div>
                  </div>
                  <div className="flex">
                    <pre className="flex-1 border-r border-zinc-800 bg-red-950/10 p-4 text-[11px] leading-relaxed text-red-300/80">
                      <code>{`func Cleanup() {
  os.RemoveAll("/tmp/data")
  return nil
}`}</code>
                    </pre>
                    <pre className="flex-1 bg-emerald-950/10 p-4 text-[11px] leading-relaxed text-emerald-300/80">
                      <code>{`func Cleanup() error {
  return os.RemoveAll("/tmp/data")
}`}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>

            {/* Discussion / Comments */}
            <div className="mb-8">
              <div className="mb-4 flex items-center gap-2">
                <MessageCircle className="h-4 w-4 text-zinc-500" />
                <span className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                  Discussion ({issue.comments.length})
                </span>
              </div>

              {issue.comments.length === 0 ? (
                <div className="rounded-xl border border-zinc-800 p-8 text-center text-sm text-zinc-600">
                  No comments yet. Be the first to discuss this issue.
                </div>
              ) : (
                <div className="space-y-4">
                  {issue.comments.map((comment) => (
                    <div
                      key={comment.id}
                      className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5"
                    >
                      <div className="mb-3 flex items-center gap-3">
                        {comment.avatarUrl ? (
                          <Image
                            src={comment.avatarUrl}
                            alt=""
                            width={28}
                            height={28}
                            className="h-7 w-7 rounded-full object-cover"
                            unoptimized
                          />
                        ) : (
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">
                            {comment.username.substring(0, 2).toUpperCase()}
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-zinc-200">
                              @{comment.username}
                            </span>
                            <span className="rounded bg-zinc-800 px-1.5 py-0.5 text-[10px] font-bold text-zinc-500">
                              L{comment.level}
                            </span>
                          </div>
                          <div className="text-[11px] text-zinc-600">
                            {timeAgo(comment.createdAt)}
                          </div>
                        </div>
                      </div>
                      <div className="text-sm leading-relaxed text-zinc-300">{comment.body}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Sidebar - Claiming Widget */}
        <aside className="hidden w-72 shrink-0 border-l border-zinc-800 p-6 xl:block">
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-5">
            <div className="mb-4 space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="text-zinc-500">Estimated Duration</span>
                <span className="flex items-center gap-1 font-semibold text-zinc-300">
                  <Clock className="h-3.5 w-3.5 text-zinc-500" />~
                  {issue.difficulty === 'E' ? '2' : issue.difficulty === 'M' ? '4' : '8'} Hours
                </span>
              </div>
              {issue.xpReward && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-zinc-500">XP Reward</span>
                  <span className="font-mono font-bold text-[#00FF87]">
                    {formatXp(issue.xpReward)}
                  </span>
                </div>
              )}
            </div>

            {claimResult === 'claimed' || isClaimed ? (
              <div className="space-y-3">
                <div className="flex items-center gap-2 rounded-lg bg-emerald-950/20 px-4 py-3 text-sm text-emerald-400">
                  <CheckCircle2 className="h-4 w-4 shrink-0" />
                  <span>Claimed by you</span>
                </div>
                <button
                  onClick={handleUnclaim}
                  disabled={claimPending}
                  className="w-full rounded-xl border border-zinc-700 py-2.5 text-xs font-bold uppercase tracking-wider text-zinc-400 transition-colors hover:border-red-800 hover:text-red-400"
                >
                  {claimPending ? <Loader2 className="mx-auto h-4 w-4 animate-spin" /> : 'Unclaim'}
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <button
                  onClick={handleClaim}
                  disabled={claimPending}
                  className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00FF87] py-2.5 text-sm font-bold text-black transition-colors hover:bg-[#00CC6A] disabled:opacity-50"
                >
                  {claimPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Zap className="h-4 w-4" />
                  )}
                  Claim Issue
                </button>
                <p className="text-center text-[10px] leading-relaxed text-zinc-600">
                  By claiming, you commit to submitting a PR within 48 hours.
                </p>
              </div>
            )}

            {claimResult === 'error' && (
              <p className="mt-3 text-center text-[10px] text-red-400">
                Something went wrong. Please try again.
              </p>
            )}
          </div>
        </aside>
      </div>

      {/* Branch Name Modal */}
      {showBranchModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded-xl border border-zinc-800 bg-[#0D0E12] p-6 shadow-2xl">
            <h3 className="mb-2 font-display text-lg font-bold text-white">Create Branch</h3>
            <p className="mb-4 text-xs text-zinc-500">
              A new branch will be created from the latest commit on the default branch.
            </p>
            <input
              type="text"
              value={branchName}
              onChange={(e) => setBranchName(e.target.value)}
              className="w-full rounded-lg border border-zinc-700 bg-zinc-900 px-4 py-2.5 text-sm text-white outline-none transition-colors focus:border-[#00FF87]"
              placeholder="branch-name"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                onClick={() => setShowBranchModal(false)}
                className="rounded-lg border border-zinc-700 px-4 py-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:border-zinc-600"
              >
                Cancel
              </button>
              <button
                onClick={confirmBranch}
                className="rounded-lg bg-[#00FF87] px-4 py-2 text-xs font-bold uppercase tracking-wider text-black transition-colors hover:bg-[#00CC6A]"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
