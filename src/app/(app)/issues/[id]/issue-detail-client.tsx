'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ExternalLink,
  GitBranch,
  Clock,
  Zap,
  AlertTriangle,
  Settings,
  FileText,
  Activity,
  MessageSquare,
  User,
} from 'lucide-react';
import {
  claimIssue,
  unclaimIssue,
  createBranchForIssue,
  type IssueDetail,
} from '@/app/actions/issues';

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const DIFF_LABEL: Record<string, string> = { E: 'EASY', M: 'MEDIUM', H: 'HARD' };
const DIFF_CLS: Record<string, string> = {
  E: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-400',
  M: 'border-yellow-500/40 bg-yellow-500/10 text-yellow-400',
  H: 'border-red-500/40 bg-red-500/10 text-red-400',
};

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

/* ------------------------------------------------------------------ */
/*  Mock discussion data (will be replaced by real API later)          */
/* ------------------------------------------------------------------ */

const MOCK_COMMENTS = [
  {
    id: 1,
    author: 'alex-maintainer',
    level: 4,
    body: 'Good catch — the cleanup goroutine leaks when the context is cancelled before the ticker fires. A deferred cancel should fix it.',
    createdAt: '2026-07-18T10:30:00Z',
  },
  {
    id: 2,
    author: 'sara-dev',
    level: 2,
    body: 'I can reproduce this on v2.1.3. The leak shows up after ~200 iterations in the benchmark suite.',
    createdAt: '2026-07-19T14:15:00Z',
  },
];

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export function IssueDetailClient({ issue }: { issue: IssueDetail }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [branchName, setBranchName] = useState<string | null>(null);
  const [branchError, setBranchError] = useState<string | null>(null);
  const [claimError, setClaimError] = useState<string | null>(null);
  const [localStatus, setLocalStatus] = useState(issue.userRecStatus);
  const [localRecId, setLocalRecId] = useState(issue.userRecId);

  const isClaimed = localStatus === 'claimed';
  const owner: string = issue.repoFullName.split('/')[0] ?? '';
  const repoName: string = issue.repoFullName.split('/')[1] ?? issue.repoFullName;

  /* --- Actions --- */

  const handleClaim = () => {
    setClaimError(null);
    startTransition(async () => {
      const res = await claimIssue(issue.id);
      if (!res.ok) {
        setClaimError(res.error.message);
        return;
      }
      setLocalStatus('claimed');
      setLocalRecId(res.data.recId);
      router.refresh();
    });
  };

  const handleUnclaim = () => {
    if (!localRecId) return;
    setClaimError(null);
    startTransition(async () => {
      const res = await unclaimIssue(localRecId!);
      if (!res.ok) {
        setClaimError(res.error.message);
        return;
      }
      setLocalStatus(null);
      setLocalRecId(null);
      router.refresh();
    });
  };

  const handleCreateBranch = () => {
    setBranchError(null);
    startTransition(async () => {
      const res = await createBranchForIssue(issue.id);
      if (!res.ok) {
        setBranchError(res.error.message);
        return;
      }
      setBranchName(res.data.branchName);
      setLocalStatus('claimed');
      router.refresh();
    });
  };

  /* --- Render sections of body_excerpt --- */
  const bodyLines = (issue.bodyExcerpt ?? issue.summary ?? '').split('\n');
  const sections: { title: string; content: string }[] = [];
  let currentSection = { title: 'Description', content: '' };

  for (const line of bodyLines) {
    const heading = line.match(/^##?\s+(.+)/);
    if (heading && heading[1]) {
      if (currentSection.content.trim()) sections.push({ ...currentSection });
      currentSection = { title: heading[1], content: '' };
    } else {
      currentSection.content += line + '\n';
    }
  }
  if (currentSection.content.trim()) sections.push(currentSection);
  if (sections.length === 0) {
    sections.push({ title: 'Description', content: 'No description provided.' });
  }

  return (
    <div className="min-h-screen bg-[#0D0E12] font-mono text-white">
      {/* Grid background */}
      <div
        className="pointer-events-none fixed inset-0 opacity-30"
        style={{
          backgroundImage:
            'linear-gradient(rgba(0,255,135,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,135,0.03) 1px, transparent 1px)',
          backgroundSize: '48px 48px',
        }}
      />

      <div className="relative z-10">
        {/* Breadcrumbs & Header */}
        <div className="border-b border-zinc-800 px-8 py-5">
          <div className="mx-auto max-w-7xl">
            {/* Breadcrumbs */}
            <div className="mb-4 flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-500">
              <Link
                href="/issues"
                className="transition-colors hover:text-[#00FF87]"
                id="breadcrumb-issues"
              >
                Issues
              </Link>
              <span>/</span>
              <span className="text-zinc-400">{issue.repoFullName}</span>
              <span>/</span>
              <span className="text-[#00FF87]">#{issue.githubIssueNumber}</span>
            </div>

            {/* Action row */}
            <div className="flex flex-wrap items-center gap-4">
              <Link
                href="/issues"
                className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 transition-colors hover:text-white"
                id="back-to-issues"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to Issues
              </Link>

              <a
                href={issue.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ml-auto flex items-center gap-2 border border-zinc-700 px-4 py-2 text-[11px] uppercase tracking-widest text-zinc-300 transition-all hover:border-[#00FF87] hover:text-[#00FF87]"
                id="view-on-github"
              >
                <ExternalLink className="h-3.5 w-3.5" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Main layout */}
        <div className="mx-auto max-w-7xl px-8 py-8">
          <div className="grid grid-cols-1 gap-8 lg:grid-cols-[220px_1fr_280px]">
            {/* ============ LEFT SIDEBAR ============ */}
            <aside className="hidden lg:block">
              <div className="sticky top-8 space-y-3">
                <button
                  onClick={handleCreateBranch}
                  disabled={isPending}
                  className="flex w-full items-center gap-2 border border-[#00FF87]/30 bg-[#00FF87]/5 px-4 py-3 text-[11px] uppercase tracking-widest text-[#00FF87] transition-all hover:border-[#00FF87]/60 hover:bg-[#00FF87]/10 disabled:opacity-40"
                  id="new-branch-btn"
                >
                  <GitBranch className="h-4 w-4" />
                  {isPending ? '...' : '+ New Branch'}
                </button>

                {branchName && (
                  <div className="border border-emerald-800/40 bg-emerald-900/20 px-3 py-2 text-[10px] text-emerald-400">
                    <span className="mb-1 block text-zinc-500">BRANCH CREATED</span>
                    <code className="break-all">{branchName}</code>
                  </div>
                )}
                {branchError && (
                  <div className="border border-red-800/40 bg-red-900/20 px-3 py-2 text-[10px] text-red-400">
                    {branchError}
                  </div>
                )}

                <div className="mt-6 space-y-1 border-t border-zinc-800 pt-4">
                  {[
                    { icon: Settings, label: 'Settings' },
                    { icon: FileText, label: 'Documentation' },
                    { icon: Activity, label: 'System Status' },
                  ].map(({ icon: Icon, label }) => (
                    <button
                      key={label}
                      className="flex w-full items-center gap-2 px-3 py-2 text-[10px] uppercase tracking-widest text-zinc-600 transition-colors hover:text-zinc-300"
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>
            </aside>

            {/* ============ MAIN CONTENT ============ */}
            <div className="min-w-0 animate-fade-in">
              {/* Issue Header Card */}
              <div
                className="mb-8 border border-zinc-800 bg-gradient-to-br from-[#0D0E12] to-[#131520] p-6"
                style={{ backdropFilter: 'blur(12px)' }}
              >
                <div className="mb-4 flex flex-wrap items-center gap-3">
                  <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
                    {owner}
                  </span>
                  <span className="text-zinc-600">/</span>
                  <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
                    {repoName}
                  </span>

                  {/* Status */}
                  <span
                    className={`px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${
                      issue.state === 'open'
                        ? 'border border-[#00FF87]/30 bg-[#00FF87]/10 text-[#00FF87]'
                        : 'border border-zinc-700 bg-zinc-800 text-zinc-500'
                    }`}
                  >
                    {issue.state}
                  </span>

                  {/* Difficulty */}
                  {issue.difficulty && (
                    <span
                      className={`border px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-widest ${DIFF_CLS[issue.difficulty]}`}
                    >
                      {DIFF_LABEL[issue.difficulty]}
                    </span>
                  )}

                  {/* XP */}
                  {issue.xpReward && (
                    <span className="ml-auto flex items-center gap-1 text-[11px] font-bold text-[#00FF87]">
                      <Zap className="h-3.5 w-3.5" />+{issue.xpReward} XP
                    </span>
                  )}
                </div>

                <h1 className="mb-3 font-serif text-2xl leading-snug text-white">{issue.title}</h1>

                <div className="flex flex-wrap items-center gap-4 text-[10px] uppercase tracking-widest text-zinc-500">
                  {issue.authorLogin && (
                    <span className="flex items-center gap-1.5">
                      <User className="h-3 w-3" />
                      {issue.authorLogin}
                    </span>
                  )}
                  <span>#{issue.githubIssueNumber}</span>
                  {issue.githubCreatedAt && <span>Opened {timeAgo(issue.githubCreatedAt)}</span>}
                  <span className="flex items-center gap-1">
                    <MessageSquare className="h-3 w-3" />
                    {issue.commentsCount} comments
                  </span>
                </div>

                {/* Labels */}
                {issue.labels && issue.labels.length > 0 && (
                  <div className="mt-4 flex flex-wrap gap-2">
                    {issue.labels.map((label) => (
                      <span
                        key={label}
                        className="border border-zinc-800 bg-zinc-900/50 px-2 py-0.5 text-[10px] text-zinc-400"
                      >
                        {label}
                      </span>
                    ))}
                  </div>
                )}

                {isClaimed && (
                  <div className="mt-4 flex items-center gap-2 border-t border-zinc-800 pt-3">
                    <span className="bg-purple-900/50 px-2 py-0.5 text-[10px] uppercase text-purple-300">
                      CLAIMED
                    </span>
                    <span className="text-[10px] uppercase tracking-widest text-purple-400">
                      You are working on this issue
                    </span>
                  </div>
                )}
              </div>

              {/* Structured Content Sections */}
              <div className="mb-8 space-y-6">
                {sections.map((section, i) => (
                  <div key={i} className="border border-zinc-800 bg-[#0D0E12] p-6">
                    <h2 className="mb-4 text-[11px] uppercase tracking-widest text-[#00FF87]">
                      {section.title}
                    </h2>
                    <div className="whitespace-pre-wrap text-[13px] leading-relaxed text-zinc-300">
                      {section.content.trim()}
                    </div>
                  </div>
                ))}
              </div>

              {/* Code Context Widget */}
              <div className="mb-8 border border-zinc-800 bg-[#0D0E12] p-6">
                <h2 className="mb-4 text-[11px] uppercase tracking-widest text-[#00FF87]">
                  Code Context
                </h2>

                <div className="mb-3 flex items-center gap-2">
                  <FileText className="h-3.5 w-3.5 text-zinc-500" />
                  <span className="font-mono text-[12px] text-zinc-400">pkg/runner/cleanup.go</span>
                </div>

                {/* Diff viewer */}
                <div className="overflow-x-auto rounded border border-zinc-800 bg-[#080810] font-mono text-[12px]">
                  <div className="border-b border-zinc-800 px-4 py-1.5 text-[10px] uppercase tracking-widest text-red-400/70">
                    Current Implementation
                  </div>
                  <pre className="px-4 py-3 text-red-300/80">
                    {`- func (r *Runner) cleanup(ctx context.Context) {
-     ticker := time.NewTicker(30 * time.Second)
-     // BUG: context cancellation not handled
-     for range ticker.C {
-         r.sweep()
-     }
- }`}
                  </pre>
                  <div className="border-b border-t border-zinc-800 px-4 py-1.5 text-[10px] uppercase tracking-widest text-emerald-400/70">
                    Proposed Fix
                  </div>
                  <pre className="px-4 py-3 text-emerald-300/80">
                    {`+ func (r *Runner) cleanup(ctx context.Context) {
+     ticker := time.NewTicker(30 * time.Second)
+     defer ticker.Stop()
+     for {
+         select {
+         case <-ctx.Done():
+             return
+         case <-ticker.C:
+             r.sweep()
+         }
+     }
+ }`}
                  </pre>
                </div>
              </div>

              {/* Discussion Section */}
              <div className="border border-zinc-800 bg-[#0D0E12] p-6">
                <h2 className="mb-6 text-[11px] uppercase tracking-widest text-[#00FF87]">
                  Discussion
                </h2>

                <div className="space-y-5">
                  {MOCK_COMMENTS.map((comment) => (
                    <div
                      key={comment.id}
                      className="border-b border-zinc-800/50 pb-5 last:border-0 last:pb-0"
                    >
                      <div className="mb-2 flex items-center gap-3">
                        <div className="flex h-8 w-8 items-center justify-center bg-zinc-800 text-[10px] font-bold uppercase text-zinc-400">
                          {comment.author.slice(0, 2)}
                        </div>
                        <span className="text-[12px] font-bold text-zinc-200">
                          {comment.author}
                        </span>
                        <span className="border border-purple-700/40 bg-purple-900/30 px-1.5 py-0.5 text-[9px] font-bold uppercase text-purple-400">
                          L{comment.level}
                        </span>
                        <span className="ml-auto text-[10px] uppercase tracking-widest text-zinc-600">
                          {timeAgo(comment.createdAt)}
                        </span>
                      </div>
                      <p className="pl-11 text-[13px] leading-relaxed text-zinc-400">
                        {comment.body}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* ============ RIGHT SIDEBAR — Claiming Widget ============ */}
            <aside>
              <div className="sticky top-8 space-y-4 lg:block">
                <div
                  className="border border-zinc-800 bg-gradient-to-b from-[#111320] to-[#0D0E12] p-5"
                  style={{ backdropFilter: 'blur(12px)' }}
                >
                  <h3 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-400">
                    Claim This Issue
                  </h3>

                  <div className="mb-4 flex items-center gap-3 border-b border-zinc-800 pb-4">
                    <Clock className="h-4 w-4 text-zinc-500" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                        Est. Duration
                      </div>
                      <div className="text-[14px] font-bold text-white">~2 Hours</div>
                    </div>
                  </div>

                  <div className="mb-5 flex items-center gap-3 border-b border-zinc-800 pb-4">
                    <Zap className="h-4 w-4 text-[#00FF87]" />
                    <div>
                      <div className="text-[10px] uppercase tracking-widest text-zinc-600">
                        XP Reward
                      </div>
                      <div className="text-[14px] font-bold text-[#00FF87]">
                        +{issue.xpReward ?? 50} XP
                      </div>
                    </div>
                  </div>

                  {claimError && (
                    <div className="mb-4 border border-red-800/40 bg-red-900/20 px-3 py-2 text-[10px] text-red-400">
                      {claimError}
                    </div>
                  )}

                  {isClaimed ? (
                    <div className="space-y-3">
                      <div className="border border-purple-700/30 bg-purple-900/20 px-4 py-3 text-center text-[11px] uppercase tracking-widest text-purple-300">
                        Issue Claimed
                      </div>
                      <button
                        onClick={handleUnclaim}
                        disabled={isPending}
                        className="w-full border border-zinc-700 px-4 py-2.5 text-[10px] uppercase tracking-widest text-zinc-500 transition-all hover:border-red-800 hover:text-red-400 disabled:opacity-40"
                        id="unclaim-issue-btn"
                      >
                        {isPending ? '...' : 'Unclaim Issue'}
                      </button>
                    </div>
                  ) : (
                    <button
                      onClick={handleClaim}
                      disabled={isPending}
                      className="w-full border border-[#00FF87]/40 bg-[#00FF87]/10 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-[#00FF87] transition-all hover:border-[#00FF87]/70 hover:bg-[#00FF87]/20 hover:shadow-[0_0_20px_rgba(0,255,135,0.15)] disabled:opacity-40"
                      id="claim-issue-btn"
                    >
                      {isPending ? 'Claiming...' : 'Claim Issue'}
                    </button>
                  )}

                  <div className="mt-4 flex items-start gap-2 text-[10px] leading-snug text-zinc-600">
                    <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-yellow-600" />
                    By claiming, you commit to submitting a PR within 48 hours.
                  </div>
                </div>

                {/* Mobile branch button (visible < lg) */}
                <button
                  onClick={handleCreateBranch}
                  disabled={isPending}
                  className="flex w-full items-center justify-center gap-2 border border-[#00FF87]/30 bg-[#00FF87]/5 px-4 py-3 text-[11px] uppercase tracking-widest text-[#00FF87] transition-all hover:border-[#00FF87]/60 hover:bg-[#00FF87]/10 disabled:opacity-40 lg:hidden"
                  id="new-branch-btn-mobile"
                >
                  <GitBranch className="h-4 w-4" />
                  {isPending ? '...' : '+ New Branch'}
                </button>
              </div>
            </aside>
          </div>
        </div>
      </div>
    </div>
  );
}
