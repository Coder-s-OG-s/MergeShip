import Link from 'next/link';
import { PRBreadcrumb } from './breadcrumb';
import { notFound, redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getPrDetails, getPrActivityTimeline, previewMergeXp } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { VerifyButton } from '@/app/(app)/issues/verify-button';
import { MergeDecisionPanel } from './merge-decision-panel';
import {
  GitPullRequest,
  MessageSquare,
  GitCommit,
  CheckCircle2,
  XCircle,
  FileText,
  ArrowLeft,
  ExternalLink,
  User,
  Award,
  GitBranch,
} from 'lucide-react';

export const dynamic = 'force-dynamic';

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  const min = Math.floor(ms / 60000);
  if (min < 1) return 'just now';
  if (min < 60) return `${min}m ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return new Date(iso).toLocaleDateString();
}

export default async function PrDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const resolvedParams = await params;
  const prId = parseInt(resolvedParams.id, 10);
  if (isNaN(prId)) notFound();

  const sb = await getServerSupabase();
  if (!sb) {
    return (
      <div className="min-h-screen px-6 py-20 text-white">
        <p className="text-gray-400">Auth not configured.</p>
      </div>
    );
  }

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  if (!(await isUserMaintainer(user.id))) {
    redirect('/');
  }

  const detailsRes = await getPrDetails(prId);
  if (!isOk(detailsRes)) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-xl text-center">
          <h1 className="mb-4 text-2xl font-bold">Access Denied or Not Found</h1>
          <p className="mb-6 text-zinc-400">
            The pull request you requested does not exist or you do not have permission to maintain
            its repository.
          </p>
          <Link
            href="/maintainer"
            className="inline-flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-zinc-300 transition-all hover:border-zinc-700 hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to Maintainer Panel
          </Link>
        </div>
      </div>
    );
  }
  const pr = detailsRes.data;

  const timelineRes = await getPrActivityTimeline(prId);
  const timelineEvents = isOk(timelineRes) ? timelineRes.data : [];

  const previewRes = await previewMergeXp(prId);
  const preview = isOk(previewRes) ? previewRes.data : null;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        {/* Back Link */}
        <div className="mb-6">
          <Link
            href="/maintainer"
            className="inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to PR Queue
          </Link>
        </div>

        <PRBreadcrumb
          repoFullName={pr.repoFullName}
          prNumber={pr.number}
          installationId={pr.installationId!}
        />

        {/* Layout grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main timeline + Header (2 cols) */}
          <div className="space-y-6 lg:col-span-2">
            {/* Header Section */}
            <header className="rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 backdrop-blur-md">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-center gap-2 text-xs text-zinc-500">
                    <GitBranch className="h-3 w-3" />
                    <span>{pr.repoFullName}</span>
                    <span>·</span>
                    <span>#{pr.number}</span>
                  </div>
                  <h1 className="mb-4 font-display text-2xl font-bold leading-tight text-white md:text-3xl">
                    {pr.title}
                  </h1>

                  {/* Status Pill Row */}
                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wider ${
                        pr.state === 'open'
                          ? 'border border-emerald-500/30 bg-emerald-950 text-emerald-400'
                          : pr.state === 'merged'
                            ? 'border border-purple-500/30 bg-purple-950 text-purple-400'
                            : 'border border-zinc-800 bg-zinc-900 text-zinc-400'
                      }`}
                    >
                      {pr.state}
                    </span>

                    {pr.draft && (
                      <span className="rounded-full bg-zinc-800 px-3 py-1 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                        Draft
                      </span>
                    )}

                    {pr.mentorVerified ? (
                      <span className="rounded-full border border-emerald-500/30 bg-emerald-950/80 px-3 py-1 text-xs font-medium text-emerald-300">
                        ✓ Mentor verified{' '}
                        {pr.mentorReviewerHandle && `by @${pr.mentorReviewerHandle}`}
                      </span>
                    ) : (
                      pr.authorUserId !== user.id &&
                      pr.state === 'open' && <VerifyButton prId={pr.id} prUrl={pr.url} />
                    )}
                  </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <a
                    href={pr.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-violet-600 to-indigo-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-indigo-500/10 transition-all hover:from-violet-500 hover:to-indigo-500 hover:shadow-indigo-500/20 active:scale-[0.98]"
                  >
                    View on GitHub <ExternalLink className="h-4 w-4" />
                  </a>
                </div>
              </div>

              {/* Author Sub-card */}
              <div className="mt-6 flex flex-wrap items-center justify-between gap-4 border-t border-zinc-800/80 pt-6 text-sm text-zinc-400">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800 text-zinc-300">
                    <User className="h-5 w-5" />
                  </div>
                  <div>
                    <p className="font-semibold text-white">@{pr.authorLogin}</p>
                    <p className="text-xs text-zinc-500">Author</p>
                  </div>
                </div>

                <div className="flex items-center gap-6">
                  {pr.authorLevel !== null && (
                    <div className="text-center md:text-left">
                      <p className="flex items-center justify-center gap-1 text-xs text-zinc-500 md:justify-start">
                        <Award className="h-3 w-3 text-amber-400" /> Level
                      </p>
                      <p className="text-base font-bold text-white">L{pr.authorLevel}</p>
                    </div>
                  )}
                  {pr.authorXp !== null && (
                    <div className="text-center md:text-left">
                      <p className="text-xs text-zinc-500">XP</p>
                      <p className="text-base font-bold text-white">
                        {pr.authorXp.toLocaleString()}
                      </p>
                    </div>
                  )}
                  {pr.authorMergedPrs !== null && pr.authorMergedPrs > 0 && (
                    <div className="text-center md:text-left">
                      <p className="text-xs text-zinc-500">Merged PRs</p>
                      <p className="text-base font-bold text-white">{pr.authorMergedPrs}</p>
                    </div>
                  )}
                </div>
              </div>
            </header>

            {/* Activity Timeline Section */}
            <section className="rounded-3xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-md">
              <h2 className="mb-6 text-lg font-bold text-white">Activity Timeline</h2>

              {timelineEvents.length === 0 ? (
                <div className="rounded-2xl border border-zinc-800/60 bg-zinc-900/40 p-8 text-center text-sm text-zinc-500">
                  No activity logs recorded for this pull request.
                </div>
              ) : (
                <div className="relative">
                  {/* Timeline Connector Line */}
                  <div className="absolute bottom-6 left-[19px] top-6 w-0.5 bg-zinc-800" />

                  <div className="space-y-6">
                    {timelineEvents.map((event) => {
                      const isApproved =
                        event.type === 'review' && event.details.state === 'approved';
                      const isChangesRequested =
                        event.type === 'review' && event.details.state === 'changes_requested';

                      return (
                        <div key={event.id} className="relative flex items-start gap-4">
                          {/* Avatar / Icon Badge */}
                          <div
                            className={`relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border ${
                              isApproved
                                ? 'border-emerald-500/40 bg-emerald-950 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                                : isChangesRequested
                                  ? 'border-rose-500/40 bg-rose-950 text-rose-400'
                                  : 'border-zinc-800 bg-zinc-900 text-zinc-400'
                            }`}
                          >
                            {event.type === 'opened' && <GitPullRequest className="h-4 w-4" />}
                            {event.type === 'commit' && <GitCommit className="h-4 w-4" />}
                            {event.type === 'comment' && <MessageSquare className="h-4 w-4" />}
                            {event.type === 'review' && (
                              <>
                                {isApproved && <CheckCircle2 className="h-4 w-4" />}
                                {isChangesRequested && <XCircle className="h-4 w-4" />}
                                {!isApproved && !isChangesRequested && (
                                  <FileText className="h-4 w-4" />
                                )}
                              </>
                            )}
                          </div>

                          {/* Event Details Card */}
                          <div className="min-w-0 flex-1 rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-4 transition-all duration-300 hover:border-zinc-700/80">
                            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-2 gap-y-1">
                              <div className="text-sm text-zinc-300">
                                {event.type === 'opened' && (
                                  <>
                                    <span className="font-semibold text-white">
                                      @{event.actor.login}
                                    </span>{' '}
                                    opened this pull request
                                  </>
                                )}

                                {event.type === 'commit' && (
                                  <>
                                    <span className="font-semibold text-white">
                                      @{event.actor.login}
                                    </span>{' '}
                                    pushed commit{' '}
                                    <code className="rounded bg-zinc-800 px-1.5 py-0.5 font-mono text-xs text-indigo-400">
                                      {event.details.sha?.substring(0, 7)}
                                    </code>
                                  </>
                                )}

                                {event.type === 'comment' && (
                                  <>
                                    <span className="font-semibold text-white">
                                      @{event.actor.login}
                                    </span>{' '}
                                    commented
                                  </>
                                )}

                                {event.type === 'review' && (
                                  <>
                                    <span className="font-semibold text-white">
                                      @{event.actor.login}
                                    </span>{' '}
                                    {isApproved && (
                                      <span className="font-semibold text-emerald-400">
                                        approved these changes
                                      </span>
                                    )}
                                    {isChangesRequested && (
                                      <span className="font-semibold text-rose-400">
                                        requested changes
                                      </span>
                                    )}
                                    {!isApproved && !isChangesRequested && (
                                      <span>submitted a review</span>
                                    )}
                                  </>
                                )}
                              </div>

                              <span className="text-xs text-zinc-500">
                                {relativeTime(event.timestamp)}
                              </span>
                            </div>

                            {/* Commits Message / Comment Body / Review Body */}
                            {event.type === 'comment' && event.details.body && (
                              <div className="mt-2 whitespace-pre-wrap border-t border-zinc-800/50 pt-2 font-sans text-sm leading-relaxed text-zinc-300">
                                {event.details.body}
                              </div>
                            )}

                            {event.type === 'review' && event.details.body && (
                              <div className="mt-2 whitespace-pre-wrap border-t border-zinc-800/50 pt-2 font-sans text-sm leading-relaxed text-zinc-300">
                                {event.details.body}
                              </div>
                            )}

                            {event.type === 'commit' && event.details.message && (
                              <div className="mt-2 border-l-2 border-zinc-800 py-0.5 pl-3 font-mono text-xs text-zinc-400">
                                {event.details.message}
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </section>
          </div>

          {/* Merge Decision Sidebar (1 col) */}
          <div className="space-y-6 lg:col-span-1">
            {/* Rewards Preview Panel */}
            {preview && (
              <div className="rounded-3xl border border-zinc-800 bg-zinc-900/60 p-6 backdrop-blur-md">
                <h2 className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                  <Award className="h-4 w-4 text-amber-400" />
                  {pr.state === 'open' ? 'Rewards Preview' : 'Rewards Awarded'}
                </h2>

                <div className="space-y-4">
                  {/* Author Reward Card */}
                  <div className="flex items-center justify-between rounded-2xl border border-zinc-800/50 bg-zinc-900/40 p-4 transition-all hover:border-zinc-700/50">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-zinc-200">
                        @{preview.author.login}
                      </p>
                      <p className="text-xs text-zinc-500">
                        {preview.author.status === 'recommended' && 'Recommended Merge'}
                        {preview.author.status === 'unrecommended' && 'Unrecommended Merge'}
                        {preview.author.status === 'self_merge' && 'Self Merge (0 XP)'}
                      </p>
                    </div>
                    <span
                      className={`shrink-0 rounded-xl px-2.5 py-1 text-sm font-bold ${
                        preview.author.xp > 0
                          ? 'border border-emerald-500/30 bg-emerald-950/80 text-emerald-400'
                          : 'bg-zinc-800 text-zinc-500'
                      }`}
                    >
                      +{preview.author.xp} XP
                    </span>
                  </div>

                  {/* Reviewers Rewards list */}
                  <div className="border-t border-zinc-800/80 pt-4">
                    <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-zinc-500">
                      Reviewer Rewards
                    </p>
                    {preview.reviewers.length === 0 ? (
                      <p className="text-xs italic text-zinc-500">No reviewers registered yet.</p>
                    ) : (
                      <div className="space-y-2">
                        {preview.reviewers.map((rev) => (
                          <div
                            key={rev.login}
                            className="flex items-center justify-between rounded-xl border border-zinc-800/30 bg-zinc-900/20 px-3 py-2.5 transition-all hover:border-zinc-800"
                          >
                            <div className="min-w-0">
                              <p className="truncate text-xs font-medium text-zinc-300">
                                @{rev.login}
                              </p>
                              <p className="text-[10px] text-zinc-500">
                                {rev.isMentor ? 'Mentor Reviewer' : 'Reviewer'}
                              </p>
                            </div>
                            <span className="shrink-0 rounded-lg border border-indigo-500/20 bg-indigo-950/80 px-2 py-0.5 text-xs font-bold text-indigo-400">
                              +{rev.xp} XP
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Merge Decision Card */}
            <div className="sticky top-6 rounded-3xl border border-zinc-800 bg-zinc-900 p-6">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
                Merge Decision
              </h2>
              {pr.state === 'open' ? (
                <MergeDecisionPanel
                  prId={prId}
                  mentorVerified={pr.mentorVerified}
                  aiFlagged={pr.aiFlagged ?? false}
                  installationId={pr.installationId!}
                  repoFullName={pr.repoFullName}
                  prNumber={pr.number}
                />
              ) : (
                <p className="text-sm text-zinc-500">
                  This PR is already {pr.state} — no actions available.
                </p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
