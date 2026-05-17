import { notFound } from 'next/navigation';
import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheGet, cacheSet } from '@/lib/cache';
import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import { CopyButton } from '@/components/copy-button';

export const revalidate = 300;

const LEVEL_LABEL: Record<number, string> = {
  0: 'L0 NEWCOMER',
  1: 'L1 CONTRIBUTOR',
  2: 'L2 PRACTITIONER',
  3: 'L3 EXPERT',
  4: 'L4 ARCHITECT',
};

function levelLabel(level: number) {
  return LEVEL_LABEL[level] ?? `L${level} CONTRIBUTOR`;
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'today';
  if (days === 1) return '1 day ago';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;
  const months = Math.floor(days / 30);
  return `${months} month${months > 1 ? 's' : ''} ago`;
}

type Achievement = {
  id: string;
  icon: string;
  label: string;
  locked: boolean;
};

type TimelineEvent = {
  id: string;
  type: 'PR_MERGED' | 'ISSUE_CLAIMED' | 'LEVEL_UP' | 'XP_EARNED' | 'MENTORED';
  title: string;
  subtitle: string;
  timestamp: string;
};

type OrgEntry = {
  login: string;
  role: string;
};

type ActiveTask = {
  id: number;
  title: string;
  repoFullName: string;
  issueNumber: number;
  url: string;
  difficulty: string | null;
};

type ProfileData = {
  githubHandle: string;
  displayName: string | null;
  avatarUrl: string | null;
  level: number;
  xp: number;
  prsMerged: number;
  menteesHelped: number;
  orgsContributed: number;
  streakDays: number;
  achievements: Achievement[];
  timeline: TimelineEvent[];
  orgs: OrgEntry[];
  activeTasks: ActiveTask[];
};

async function loadProfileData(handle: string): Promise<ProfileData | null> {
  const cacheKey = `profile:v2:${handle}`;
  const cached = await cacheGet<ProfileData>(cacheKey);
  if (cached) return cached;

  const service = getServiceSupabase();
  if (!service) return null;

  const { data: profile } = await service
    .from('profiles')
    .select('id, github_handle, display_name, avatar_url, level, xp, github_streak')
    .eq('github_handle', handle)
    .maybeSingle();

  if (!profile) return null;

  // Fetch all data in parallel
  const [
    prsResult,
    menteesResult,
    installsResult,
    claimedRecsResult,
    recentPRsResult,
    recentRecsResult,
  ] = await Promise.all([
    // Merged PRs count
    service
      .from('pull_requests')
      .select('id', { count: 'exact', head: true })
      .eq('author_user_id', profile.id)
      .eq('state', 'merged'),

    // Mentees helped
    service
      .from('help_requests')
      .select('id', { count: 'exact', head: true })
      .eq('resolved_by', profile.id),

    // GitHub installations (orgs)
    service
      .from('github_installations')
      .select('account_login')
      .eq('user_id', profile.id)
      .is('uninstalled_at', null),

    // Active claimed tasks
    service
      .from('recommendations')
      .select(`id, difficulty, issues ( title, repo_full_name, github_issue_number, url )`)
      .eq('user_id', profile.id)
      .eq('status', 'claimed')
      .limit(4),

    // Recent PRs for timeline
    service
      .from('pull_requests')
      .select('id, title, repo_full_name, number, state, url, github_created_at, merged_at')
      .eq('author_user_id', profile.id)
      .order('github_created_at', { ascending: false })
      .limit(10),

    // Recent recommendations for timeline
    service
      .from('recommendations')
      .select('id, status, claimed_at, issues ( title, repo_full_name, github_issue_number )')
      .eq('user_id', profile.id)
      .in('status', ['claimed', 'completed'])
      .order('claimed_at', { ascending: false })
      .limit(5),
  ]);

  const prsMerged = prsResult.count ?? 0;
  const menteesHelped = menteesResult.count ?? 0;

  const orgs: OrgEntry[] = (installsResult.data ?? []).map((i: any) => ({
    login: i.account_login,
    role: 'CONTRIBUTOR',
  }));
  const orgsContributed = orgs.length;

  // Active tasks
  const activeTasks: ActiveTask[] = (claimedRecsResult.data ?? []).map((r: any) => {
    const issue = Array.isArray(r.issues) ? r.issues[0] : r.issues;
    return {
      id: r.id,
      title: issue?.title ?? 'Unknown',
      repoFullName: issue?.repo_full_name ?? '',
      issueNumber: issue?.github_issue_number ?? 0,
      url: issue?.url ?? '#',
      difficulty: r.difficulty,
    };
  });

  // Build timeline from PRs + recommendations
  const timelineEvents: TimelineEvent[] = [];

  for (const pr of recentPRsResult.data ?? []) {
    if (pr.state === 'merged') {
      timelineEvents.push({
        id: `pr-merged-${pr.id}`,
        type: 'PR_MERGED',
        title: pr.title,
        subtitle: `${pr.repo_full_name} #${pr.number}`,
        timestamp: (pr as any).merged_at ?? pr.github_created_at,
      });
    } else if (pr.state === 'open') {
      timelineEvents.push({
        id: `pr-open-${pr.id}`,
        type: 'XP_EARNED',
        title: pr.title,
        subtitle: `${pr.repo_full_name} #${pr.number}`,
        timestamp: pr.github_created_at,
      });
    }
  }

  for (const rec of recentRecsResult.data ?? []) {
    const issue = Array.isArray(rec.issues) ? rec.issues[0] : rec.issues;
    if (rec.claimed_at && issue) {
      timelineEvents.push({
        id: `rec-${rec.id}`,
        type: 'ISSUE_CLAIMED',
        title: issue.title,
        subtitle: `${issue.repo_full_name} #${issue.github_issue_number}`,
        timestamp: rec.claimed_at,
      });
    }
  }

  // Sort by timestamp desc and take top 6
  timelineEvents.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  const timeline = timelineEvents.slice(0, 6);

  // Achievements
  const achievements: Achievement[] = [
    {
      id: 'first_merge',
      icon: '🚀',
      label: 'FIRST MERGE',
      locked: prsMerged === 0,
    },
    {
      id: 'first_mentee',
      icon: '🎓',
      label: 'FIRST MENTEE',
      locked: menteesHelped === 0,
    },
    {
      id: 'streak_5',
      icon: '🔥',
      label: '5-DAY STREAK',
      locked: (profile.github_streak ?? 0) < 5,
    },
    {
      id: 'ten_prs',
      icon: '⚡',
      label: '10 MERGED',
      locked: prsMerged < 10,
    },
    {
      id: 'l3_expert',
      icon: '🔒',
      label: 'L3 EXPERT',
      locked: profile.level < 3,
    },
  ];

  const { getPublicStreak } = await import('@/app/actions/streak');
  const { days: streakDays } = await getPublicStreak(profile.id);

  const data: ProfileData = {
    githubHandle: profile.github_handle,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    level: profile.level,
    xp: profile.xp,
    prsMerged,
    menteesHelped,
    orgsContributed,
    streakDays,
    achievements,
    timeline,
    orgs,
    activeTasks,
  };

  await cacheSet(cacheKey, data, 300);
  return data;
}

const EVENT_COLOR: Record<string, string> = {
  PR_MERGED: 'bg-emerald-500/20 text-emerald-400 border border-emerald-700/50',
  ISSUE_CLAIMED: 'bg-blue-500/20 text-blue-400 border border-blue-700/50',
  LEVEL_UP: 'bg-purple-500/20 text-purple-400 border border-purple-700/50',
  XP_EARNED: 'bg-yellow-500/20 text-yellow-400 border border-yellow-700/50',
  MENTORED: 'bg-pink-500/20 text-pink-400 border border-pink-700/50',
};

const EVENT_DOT: Record<string, string> = {
  PR_MERGED: 'bg-emerald-400',
  ISSUE_CLAIMED: 'bg-blue-400',
  LEVEL_UP: 'bg-purple-400',
  XP_EARNED: 'bg-yellow-400',
  MENTORED: 'bg-pink-400',
};

const DIFFICULTY_LABEL: Record<string, string> = { E: 'L1', M: 'L2', H: 'L3' };

export default async function PublicProfile({ params }: { params: { handle: string } }) {
  const handle = decodeURIComponent(params.handle).replace(/^@/, '');
  const profile = await loadProfileData(handle);
  if (!profile) notFound();

  return (
    <div className="min-h-screen bg-[#0d1117] font-mono text-white">
      {/* Top nav */}
      <nav className="border-b border-[#21262d] px-8 py-4">
        <div className="mx-auto flex max-w-6xl items-center justify-between">
          <Link
            href="/dashboard"
            className="font-serif text-lg font-bold tracking-widest text-white"
          >
            MERGESHIP
          </Link>
          <Link
            href={`https://github.com/${profile.githubHandle}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 border border-[#30363d] px-4 py-2 text-[11px] uppercase tracking-widest text-zinc-300 transition-colors hover:border-zinc-500 hover:text-white"
          >
            <ExternalLink className="h-3 w-3" />
            VIEW ON GITHUB
          </Link>
        </div>
      </nav>

      {/* Hero */}
      <div className="border-b border-[#21262d] bg-gradient-to-b from-[#1a1040] to-[#0d1117]">
        <div className="mx-auto max-w-6xl px-8 py-12">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
            <div className="flex items-center gap-6">
              {profile.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.avatarUrl}
                  alt={profile.githubHandle}
                  className="h-24 w-24 rounded-sm border-2 border-[#30363d]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="flex h-24 w-24 items-center justify-center rounded-sm border-2 border-[#30363d] bg-zinc-800 text-2xl font-bold">
                  {profile.githubHandle.substring(0, 2).toUpperCase()}
                </div>
              )}
              <div>
                <div className="mb-2 flex items-center gap-3">
                  <h1 className="font-serif text-3xl font-bold text-white">
                    {profile.displayName ?? profile.githubHandle}
                  </h1>
                  <span className="border border-purple-700 bg-purple-900/30 px-3 py-1 text-[11px] uppercase tracking-widest text-purple-300">
                    {levelLabel(profile.level)}
                  </span>
                </div>
                <p className="mb-3 text-[13px] text-zinc-500">
                  @{profile.githubHandle}
                  <CopyButton
                    textToCopy={`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://mergeship.dev'}/@${profile.githubHandle}`}
                  />
                </p>
                <div className="flex flex-wrap items-center gap-4 text-[11px] uppercase tracking-widest text-zinc-400">
                  <span>
                    <span className="font-bold text-white">{profile.prsMerged}</span> PRS MERGED
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    <span className="font-bold text-white">{profile.xp.toLocaleString()}</span> XP
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    <span className="font-bold text-white">{profile.menteesHelped}</span> MENTEES
                    HELPED
                  </span>
                  <span className="text-zinc-700">·</span>
                  <span>
                    <span className="font-bold text-white">{profile.orgsContributed}</span> ORGS
                    CONTRIBUTED
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div className="mx-auto max-w-6xl px-8 py-10">
        <div className="grid grid-cols-1 gap-8 lg:grid-cols-[240px_1fr_280px]">
          {/* Left: Achievements */}
          <div>
            <h2 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-500">
              Achievements
            </h2>
            <div className="grid grid-cols-2 gap-3">
              {profile.achievements.map((a) => (
                <div
                  key={a.id}
                  className={`flex flex-col items-center gap-2 rounded-sm border p-4 text-center ${
                    a.locked
                      ? 'border-[#21262d] bg-[#161b22] opacity-50'
                      : 'border-[#30363d] bg-[#161b22]'
                  }`}
                >
                  <span className="text-2xl">{a.locked ? '🔒' : a.icon}</span>
                  <span className="text-[10px] uppercase tracking-widest text-zinc-400">
                    {a.label}
                    {a.locked && <span className="block text-zinc-600">(LOCKED)</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Middle: Timeline + Languages */}
          <div className="space-y-8">
            <div>
              <h2 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-500">
                Contribution Timeline
              </h2>

              {profile.timeline.length === 0 ? (
                <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-600">
                  No activity yet.
                </div>
              ) : (
                <div className="relative space-y-0 border-l border-[#21262d] pl-6">
                  {profile.timeline.map((event) => (
                    <div key={event.id} className="relative mb-6 last:mb-0">
                      <div
                        className={`absolute -left-[25px] top-1.5 h-2.5 w-2.5 rounded-full ${EVENT_DOT[event.type] ?? 'bg-zinc-500'}`}
                      />
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <span
                          className={`px-2 py-0.5 text-[10px] uppercase tracking-widest ${EVENT_COLOR[event.type] ?? 'bg-zinc-800 text-zinc-400'}`}
                        >
                          {event.type.replace('_', ' ')}
                        </span>
                        <span className="shrink-0 text-[10px] uppercase tracking-widest text-zinc-600">
                          {timeAgo(event.timestamp)}
                        </span>
                      </div>
                      <p className="mb-1 text-[15px] font-bold text-white">{event.title}</p>
                      <p className="text-[11px] uppercase tracking-widest text-zinc-500">
                        {event.subtitle}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="border-t border-[#21262d] pt-8">
              <h2 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-500">Stats</h2>
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
                <div className="border border-[#21262d] bg-[#161b22] p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    Total XP
                  </div>
                  <div className="font-serif text-2xl font-bold text-[#39d353]">
                    {profile.xp.toLocaleString()}
                  </div>
                </div>
                <div className="border border-[#21262d] bg-[#161b22] p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    Level
                  </div>
                  <div className="font-serif text-2xl font-bold text-white">L{profile.level}</div>
                </div>
                <div className="border border-[#21262d] bg-[#161b22] p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    PRs Merged
                  </div>
                  <div className="font-serif text-2xl font-bold text-white">
                    {profile.prsMerged}
                  </div>
                </div>
                <div className="border border-[#21262d] bg-[#161b22] p-4">
                  <div className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                    Activity Streak
                  </div>
                  <div className="font-serif text-2xl font-bold text-white">
                    {profile.streakDays}d
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: Orgs + Active Tasks */}
          <div className="space-y-8">
            {/* Organizations */}
            {profile.orgs.length > 0 && (
              <div>
                <h2 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-500">
                  Organizations
                </h2>
                <div className="space-y-3">
                  {profile.orgs.map((org) => (
                    <a
                      key={org.login}
                      href={`https://github.com/${org.login}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-3 border border-[#21262d] bg-[#161b22] p-4 transition-colors hover:border-[#30363d]"
                    >
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-[#30363d] bg-zinc-800 text-sm font-bold uppercase">
                        {org.login.substring(0, 2)}
                      </div>
                      <div>
                        <div className="text-[13px] font-bold text-white">{org.login}</div>
                        <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                          {org.role}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Active Tasks */}
            {profile.activeTasks.length > 0 && (
              <div>
                <h2 className="mb-5 text-[11px] uppercase tracking-widest text-zinc-500">
                  Active Tasks
                </h2>
                <div className="space-y-3">
                  {profile.activeTasks.map((task) => (
                    <div key={task.id} className="border border-[#21262d] bg-[#161b22] p-4">
                      <div className="mb-2 flex items-center justify-between">
                        <span className="border border-purple-800/50 bg-purple-900/40 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-400">
                          CLAIMED
                        </span>
                        <a
                          href={task.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          aria-label={`Open ${task.repoFullName} #${task.issueNumber} on GitHub`}
                          className="text-zinc-500 hover:text-zinc-300"
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      </div>
                      <p className="mb-1 text-[13px] font-bold leading-snug text-white">
                        {task.title}
                      </p>
                      <p className="text-[10px] uppercase tracking-widest text-zinc-500">
                        {task.repoFullName} #{task.issueNumber}
                      </p>
                      {task.difficulty && (
                        <span className="mt-2 inline-block border border-zinc-700 px-2 py-0.5 text-[10px] text-zinc-400">
                          {DIFFICULTY_LABEL[task.difficulty] ?? task.difficulty}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {profile.orgs.length === 0 && profile.activeTasks.length === 0 && (
              <div className="py-8 text-center text-[11px] uppercase tracking-widest text-zinc-600">
                No public activity yet.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Footer */}
      <footer className="border-t border-[#21262d] px-8 py-6 text-[10px] uppercase tracking-widest text-zinc-700">
        <div className="mx-auto flex max-w-6xl justify-between">
          <span>© 2024 MERGESHIP — ALL SYSTEMS NOMINAL</span>
          <div className="flex gap-6">
            <Link href="#" className="hover:text-zinc-500">
              PRIVACY
            </Link>
            <Link href="#" className="hover:text-zinc-500">
              TERMS
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
