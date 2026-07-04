import Link from 'next/link';
import { PRBreadcrumb } from './breadcrumb';
import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import { getMaintainerInstalls, getMaintainerPrById } from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import CiStatusBadge from '../../ci-status-badge';
import { VerifyButton } from '../../../issues/verify-button';
import { ClosePrButton } from '../../close-pr-button';
import {
  ArrowLeft,
  Calendar,
  GitPullRequest,
  Github,
  CheckCircle,
  XCircle,
  MessageSquare,
  Clock,
  AlertTriangle,
  User,
  ShieldCheck,
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

function stateColor(state: 'open' | 'closed' | 'merged'): string {
  if (state === 'open') return 'bg-emerald-900/40 text-emerald-300 border-emerald-500/30';
  if (state === 'merged') return 'bg-purple-900/40 text-purple-300 border-purple-500/30';
  return 'bg-zinc-800/80 text-zinc-400 border-zinc-700/50';
}

function AuthorBadge({
  level,
  xp,
  merged,
}: {
  level: number | null;
  xp: number | null;
  merged: number | null;
}) {
  if (level === null) {
    return <span className="text-xs text-zinc-500">not registered on MergeShip</span>;
  }
  return (
    <span className="inline-flex items-center gap-1.5 text-xs text-zinc-400">
      <span className="rounded-full bg-zinc-800/80 px-2 py-0.5 font-semibold text-zinc-300 ring-1 ring-zinc-700/50">
        L{level}
      </span>
      {xp !== null && <span>{xp.toLocaleString()} XP</span>}
      {merged !== null && merged > 0 && <span>· {merged} merged PRs</span>}
    </span>
  );
}

export default async function MaintainerPrDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ install?: string }>;
}) {
  const resolvedParams = await params;
  const resolvedSearchParams = await searchParams;

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
    redirect('/dashboard');
  }

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-3 font-display text-3xl font-bold">No installs</h1>
          <p className="text-zinc-400">
            Install the MergeShip App on a repo your organisation owns to see PRs here.
          </p>
        </div>
      </div>
    );
  }

  const activeInstallId =
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const prId = Number(resolvedParams.id);
  const prRes = await getMaintainerPrById({ installationId: activeInstallId, prId });

  if (!isOk(prRes) || !prRes.data) {
    return (
      <div className="min-h-screen bg-zinc-950 px-6 py-20 text-white">
        <div className="mx-auto max-w-xl">
          <h1 className="mb-3 font-display text-3xl font-bold">Pull Request Not Found</h1>
          <p className="text-zinc-400">
            This pull request does not exist or you do not have permission to view it.
          </p>
          <Link
            href={`/maintainer?install=${activeInstallId}`}
            className="mt-6 inline-flex items-center gap-2 text-sm text-zinc-400 transition-colors hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" /> Back to queue
          </Link>
        </div>
      </div>
    );
  }

  const pr = prRes.data;

  // Fetch reviews for the timeline
  const { data: rawReviews } = await sb
    .from('pull_request_reviews')
    .select('id, reviewer_login, state, body_excerpt, is_mentor, submitted_at')
    .eq('pr_id', pr.id)
    .order('submitted_at', { ascending: true });

  const reviews = rawReviews ?? [];

  return (
    <div className="min-h-screen bg-[#09090b] px-4 py-8 text-white sm:px-6 lg:px-8">
      <div className="mx-auto max-w-5xl">
        {/* Back navigation */}
        <Link
          href={`/maintainer?install=${activeInstallId}`}
          className="group mb-6 inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-zinc-400 transition-colors hover:text-white"
        >
          <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Back to PR Queue
        </Link>
        <PRBreadcrumb
          repoFullName={pr.repoFullName}
          prNumber={pr.number}
          installationId={activeInstallId}
        />

        {/* Top Header Card */}
        <div className="relative mb-8 overflow-hidden rounded-3xl border border-zinc-800 bg-zinc-900/40 p-6 shadow-2xl backdrop-blur-md sm:p-8">
          <div className="absolute right-0 top-0 h-40 w-40 rounded-full bg-indigo-500/10 blur-3xl" />
          <div className="absolute bottom-0 left-0 h-40 w-40 rounded-full bg-emerald-500/5 blur-3xl" />

          <div className="relative flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2 text-xs text-zinc-400">
                <span className="font-semibold text-zinc-300">{pr.repoFullName}</span>
                <span className="text-zinc-600">•</span>
                <span>#{pr.number}</span>
                <span className="text-zinc-600">•</span>
                <span className="flex items-center gap-1">
                  <Calendar className="h-3.5 w-3.5" />
                  Opened {relativeTime(pr.githubUpdatedAt)}
                </span>
              </div>

              <h1 className="font-display text-2xl font-extrabold leading-tight tracking-tight text-white sm:text-3xl">
                {pr.title}
              </h1>

              {/* Status Badges */}
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span
                  className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${stateColor(pr.state)}`}
                >
                  {pr.state.toUpperCase()}
                </span>

                <CiStatusBadge
                  installationId={activeInstallId}
                  repoFullName={pr.repoFullName}
                  prNumber={pr.number}
                />

                {pr.draft && (
                  <span className="rounded-full border border-zinc-700 bg-zinc-800 px-2.5 py-0.5 text-xs text-zinc-400">
                    Draft
                  </span>
                )}

                {pr.mentorVerified ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/20 bg-emerald-950/30 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.1)]">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    Mentor Verified
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-zinc-700 bg-zinc-800/40 px-2.5 py-0.5 text-xs font-semibold text-zinc-400">
                    Unverified
                  </span>
                )}

                {pr.aiFlagged && (
                  <span className="inline-flex animate-pulse items-center gap-1 rounded-full border border-rose-500/20 bg-rose-950/30 px-2.5 py-0.5 text-xs font-semibold text-rose-400">
                    <AlertTriangle className="h-3.5 w-3.5" />
                    AI Flagged
                  </span>
                )}
              </div>
            </div>

            {/* Actions Panel */}
            <div className="flex shrink-0 flex-wrap items-center gap-3 rounded-2xl border border-zinc-800/80 bg-zinc-950/40 p-4 md:justify-center md:self-stretch">
              {pr.state === 'open' && (
                <>
                  {!pr.mentorVerified && pr.authorUserId !== user.id && (
                    <VerifyButton prId={pr.id} prUrl={pr.url} />
                  )}
                  <ClosePrButton prId={pr.id} />
                </>
              )}

              <a
                href={pr.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 rounded border border-zinc-700 bg-zinc-800/60 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-zinc-800"
              >
                <Github className="h-4 w-4" />
                View on GitHub
              </a>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          {/* Main info (left/wide column) */}
          <div className="space-y-8 lg:col-span-2">
            {/* PR Details/Description */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-md">
              <h2 className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-3 text-lg font-bold text-white">
                <GitPullRequest className="h-5 w-5 text-indigo-400" />
                PR Description
              </h2>
              {pr.bodyExcerpt ? (
                <div className="whitespace-pre-wrap font-sans text-sm leading-relaxed text-zinc-300">
                  {pr.bodyExcerpt}
                </div>
              ) : (
                <p className="text-sm italic text-zinc-500">
                  No description provided for this pull request.
                </p>
              )}
            </section>

            {/* Timeline & Reviews */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-md">
              <h2 className="mb-6 flex items-center gap-2 border-b border-zinc-800 pb-3 text-lg font-bold text-white">
                <Clock className="h-5 w-5 text-indigo-400" />
                Activity Timeline
              </h2>

              {reviews.length === 0 ? (
                <div className="py-8 text-center">
                  <MessageSquare className="mx-auto mb-2 h-8 w-8 text-zinc-700" />
                  <p className="text-sm text-zinc-500">
                    No reviews or timeline events recorded yet.
                  </p>
                </div>
              ) : (
                <div className="relative space-y-8 border-l border-zinc-800 py-2 pl-6">
                  {reviews.map((review: any) => {
                    const isApproved = review.state === 'approved';
                    const isChanges = review.state === 'changes_requested';

                    return (
                      <div key={review.id} className="group relative">
                        {/* Timeline node icon indicator */}
                        <div className="absolute -left-[31px] top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-[#09090b]">
                          {isApproved ? (
                            <CheckCircle className="h-4.5 w-4.5 rounded-full bg-[#09090b] text-emerald-400" />
                          ) : isChanges ? (
                            <XCircle className="h-4.5 w-4.5 rounded-full bg-[#09090b] text-rose-500" />
                          ) : (
                            <MessageSquare className="h-4.5 w-4.5 rounded-full bg-[#09090b] text-zinc-400" />
                          )}
                        </div>

                        {/* Review Content Card */}
                        <div className="rounded-xl border border-zinc-800 bg-zinc-950/40 p-4 transition-all group-hover:border-zinc-700">
                          <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs">
                            <div className="flex items-center gap-2">
                              <span className="font-semibold text-zinc-200">
                                @{review.reviewer_login}
                              </span>
                              {review.is_mentor && (
                                <span className="rounded border border-indigo-500/20 bg-indigo-950/60 px-1.5 py-0.5 text-[10px] font-medium text-indigo-300">
                                  Mentor Reviewer
                                </span>
                              )}
                            </div>
                            <span className="text-zinc-500">
                              {relativeTime(review.submitted_at)}
                            </span>
                          </div>

                          <div className="mb-2 text-xs font-semibold uppercase tracking-wider">
                            {isApproved && (
                              <span className="text-emerald-400">Approved these changes</span>
                            )}
                            {isChanges && <span className="text-rose-400">Requested changes</span>}
                            {!isApproved && !isChanges && (
                              <span className="text-zinc-400">{review.state}</span>
                            )}
                          </div>

                          {review.body_excerpt && (
                            <div className="border-l-2 border-zinc-700 bg-zinc-900/10 py-1 pl-3 text-sm italic text-zinc-400">
                              "{review.body_excerpt}"
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>
          </div>

          {/* Metadata & Author sidebar (right/narrow column) */}
          <div className="space-y-6">
            {/* Contributor Card */}
            <section className="rounded-2xl border border-zinc-800 bg-zinc-900/20 p-6 backdrop-blur-md">
              <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-zinc-400">
                <User className="h-4 w-4 text-indigo-400" />
                Contributor Profile
              </h3>

              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full border border-zinc-700 bg-zinc-800 font-semibold text-zinc-400">
                    {pr.authorLogin.substring(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <h4 className="font-semibold text-white">@{pr.authorLogin}</h4>
                    <p className="text-xs text-zinc-500">Author</p>
                  </div>
                </div>

                <div className="border-t border-zinc-800 pt-2">
                  <AuthorBadge
                    level={pr.authorLevel}
                    xp={pr.authorXp}
                    merged={pr.authorMergedPrs}
                  />
                </div>
              </div>
            </section>

            {/* Mentor Verification Details */}
            {pr.mentorVerified && (
              <section className="rounded-2xl border border-emerald-950/40 bg-emerald-950/5 p-6 backdrop-blur-md">
                <h3 className="mb-4 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-emerald-400">
                  <ShieldCheck className="h-4 w-4" />
                  Mentor Verification
                </h3>

                <div className="space-y-3 text-sm text-zinc-300">
                  <p>
                    Verified by{' '}
                    <span className="font-semibold text-white">@{pr.mentorReviewerHandle}</span>
                    {pr.mentorReviewerLevel !== null && ` (Level ${pr.mentorReviewerLevel})`}
                  </p>
                  {pr.mentorReviewAt && (
                    <p className="text-xs text-zinc-500">
                      Verified on {new Date(pr.mentorReviewAt).toLocaleDateString()}
                    </p>
                  )}
                </div>
              </section>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
