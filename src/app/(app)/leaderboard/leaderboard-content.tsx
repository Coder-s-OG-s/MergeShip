'use client';

import { useMemo } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { motion } from 'framer-motion';
import { Trophy, Flame, Swords, Users, Globe, Calendar, Building2, UserPlus } from 'lucide-react';
import type { LeaderboardEntry } from '@/app/actions/leaderboard';

type Tab = 'global' | 'monthly' | 'organization' | 'friends';

const TABS: { key: Tab; label: string; icon: typeof Globe }[] = [
  { key: 'global', label: 'Global', icon: Globe },
  { key: 'monthly', label: 'Monthly', icon: Calendar },
  { key: 'organization', label: 'Organization', icon: Building2 },
  { key: 'friends', label: 'Friends', icon: UserPlus },
];

interface Props {
  activeTab: Tab;
  entries: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
  userHandle: string | null;
  userXp: number;
  userLevel: number;
  userMerges: number;
  userStreak: number;
  avatarUrl: string | null;
}

export function LeaderboardContent({
  activeTab,
  entries,
  currentUserRank,
  userHandle,
  userXp,
  userLevel,
  userMerges,
  userStreak,
  avatarUrl,
}: Props) {
  const displayEntries = useMemo(() => entries.slice(0, 50), [entries]);
  const top3 = useMemo(() => displayEntries.slice(0, 3), [displayEntries]);

  const totalContributors = entries.length;
  const totalXpShipped = entries.reduce((sum, e) => sum + e.xp, 0);

  const userRankInfo = useMemo(() => {
    if (!userHandle || !currentUserRank) return null;
    const inViewEntry = displayEntries.find((e) => e.githubHandle === userHandle);
    if (inViewEntry) return { rank: inViewEntry.rank, inView: true };
    return { rank: currentUserRank.rank, inView: false };
  }, [userHandle, currentUserRank, displayEntries]);

  const upperPercentile = userRankInfo
    ? ((totalContributors - userRankInfo.rank) / totalContributors) * 100
    : null;

  const rivals = useMemo(() => {
    if (!userHandle) return [];
    const userIndex = displayEntries.findIndex((e) => e.githubHandle === userHandle);
    if (userIndex === -1) return [];
    const before = displayEntries[userIndex - 1] ?? null;
    const after = displayEntries[userIndex + 1] ?? null;
    return [before, after].filter(Boolean) as LeaderboardEntry[];
  }, [displayEntries, userHandle]);

  const router = useRouter();
  const searchParams = useSearchParams();

  function handleTabChange(tab: Tab) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('scope', tab);
    params.delete('id');
    router.push(`/leaderboard?${params.toString()}`);
  }

  const formatXp = (xp: number) => {
    if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
    if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
    return xp.toLocaleString();
  };

  return (
    <div className="flex min-h-screen bg-[#0D0E12] font-mono text-white">
      {/* Left Sidebar */}
      <aside className="hidden w-64 shrink-0 flex-col border-r border-zinc-800 p-6 lg:flex">
        {userHandle ? (
          <>
            <div className="flex flex-col items-center gap-3 py-8">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-full bg-zinc-800 ring-2 ring-zinc-700">
                {avatarUrl ? (
                  <Image
                    src={avatarUrl}
                    alt={userHandle}
                    width={64}
                    height={64}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  <span className="text-lg font-bold text-zinc-500">
                    {userHandle.substring(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div className="text-center">
                <div className="text-sm font-bold">@{userHandle}</div>
                <div className="text-xs text-zinc-500">L{userLevel} PRACTITIONER</div>
              </div>
            </div>

            <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
              <StatItem label="Your Rank" value={`#${userRankInfo?.rank ?? '--'}`} />
              <StatItem label="Total XP" value={`${formatXp(userXp)} XP`} />
              <StatItem label="Merged PRs" value={userMerges.toString()} />
              <StatItem label="Streak" value={`${userStreak}d`} />
            </div>

            <button
              disabled
              title="Coming soon"
              className="mt-6 w-full cursor-not-allowed rounded-xl bg-[#00FF87]/40 py-3 text-sm font-bold text-black/60"
            >
              Deploy Agent (Coming Soon)
            </button>
          </>
        ) : (
          <div className="flex h-full items-center justify-center text-sm text-zinc-600">
            Sign in to see your stats
          </div>
        )}
      </aside>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-4xl px-6 py-10">
          {/* Header */}
          <div className="mb-8">
            <div className="mb-1 text-[11px] uppercase tracking-[0.2em] text-zinc-500">
              LEADERBOARD
            </div>
            <h1 className="font-display text-3xl font-bold text-white">Leaderboard</h1>
            {userRankInfo && (
              <div className="mt-1 text-sm text-zinc-400">
                YOUR RANK: #{userRankInfo.rank} &bull;{' '}
                {upperPercentile !== null ? (
                  <span className="text-neon-green">TOP {Math.round(upperPercentile)}%</span>
                ) : (
                  <span className="text-zinc-500">UNRANKED</span>
                )}
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="mb-8 flex gap-1 rounded-xl bg-zinc-900/50 p-1">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              const isActive = activeTab === tab.key;
              return (
                <button
                  key={tab.key}
                  onClick={() => handleTabChange(tab.key)}
                  className={`flex flex-1 items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-xs font-semibold uppercase tracking-wider transition-colors ${
                    isActive ? 'bg-[#00FF87] text-black' : 'text-zinc-500 hover:text-zinc-300'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {tab.label}
                </button>
              );
            })}
          </div>

          {entries.length === 0 ? (
            <div className="my-6 flex flex-col items-center justify-center rounded-2xl border border-zinc-800 bg-zinc-900/30 p-12 text-center">
              {activeTab === 'organization' ? (
                <>
                  <Building2 className="mb-4 h-12 w-12 animate-pulse text-zinc-600" />
                  <h3 className="mb-2 text-lg font-bold text-white">No Cohort Found</h3>
                  <p className="max-w-md text-sm text-zinc-500">
                    You are not currently enrolled in any organization cohort. Organization cohorts
                    are used to track progress in programs like GSoC, LFX Mentorship, or team
                    hackathons.
                  </p>
                </>
              ) : activeTab === 'friends' ? (
                <>
                  <UserPlus className="mb-4 h-12 w-12 animate-pulse text-zinc-600" />
                  <h3 className="mb-2 text-lg font-bold text-white">No Friends Found</h3>
                  {userHandle ? (
                    <p className="max-w-md text-sm text-zinc-500">
                      None of the developers you follow on GitHub are registered on MergeShip yet,
                      or you do not follow anyone. Follow other contributors on GitHub to see them
                      here!
                    </p>
                  ) : (
                    <p className="max-w-md text-sm text-zinc-500">
                      Sign in to view your friends' activity and rank on the leaderboard.
                    </p>
                  )}
                </>
              ) : (
                <>
                  <Users className="mb-4 h-12 w-12 animate-pulse text-zinc-600" />
                  <h3 className="mb-2 text-lg font-bold text-white">No Contributors Yet</h3>
                  <p className="max-w-md text-sm text-zinc-500">
                    There are currently no active contributors for this scope. Be the first to earn
                    XP and claim the top spot!
                  </p>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Podium */}
              <div className="mb-10 flex items-end justify-center gap-4">
                {top3.length === 3 ? (
                  <>
                    <PodiumCard
                      entry={top3[1]!}
                      position={2}
                      gradient="from-zinc-400 via-zinc-300 to-zinc-200"
                      shadow="shadow-[0_0_20px_rgba(192,192,192,0.3)]"
                      height="h-36"
                    />
                    <PodiumCard
                      entry={top3[0]!}
                      position={1}
                      gradient="from-yellow-400 via-yellow-300 to-amber-200"
                      shadow="shadow-[0_0_25px_rgba(255,215,0,0.4)]"
                      height="h-44"
                    />
                    <PodiumCard
                      entry={top3[2]!}
                      position={3}
                      gradient="from-orange-500 via-orange-400 to-orange-300"
                      shadow="shadow-[0_0_20px_rgba(205,127,50,0.3)]"
                      height="h-28"
                    />
                  </>
                ) : (
                  <div className="py-8 text-sm text-zinc-600">
                    Need at least 3 contributors for the podium
                  </div>
                )}
              </div>

              {/* Table */}
              <div className="overflow-hidden rounded-xl border border-zinc-800">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="border-b border-zinc-800 text-[11px] uppercase tracking-wider text-zinc-500">
                      <th className="px-5 py-3 font-medium">RANK</th>
                      <th className="px-5 py-3 font-medium">CONTRIBUTOR</th>
                      <th className="px-5 py-3 text-right font-medium">XP</th>
                      <th className="px-5 py-3 text-right font-medium">MERGED</th>
                      <th className="px-5 py-3 text-right font-medium">STREAK</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayEntries.map((entry, index) => {
                      const isMe = userHandle !== null && entry.githubHandle === userHandle;
                      return (
                        <motion.tr
                          key={entry.userId}
                          initial={{ opacity: 0, y: 4 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ duration: 0.2, delay: index * 0.02 }}
                          className={`border-b border-zinc-800/60 transition-colors hover:bg-zinc-800/30 ${
                            isMe ? 'bg-[#00FF87]/5 text-[#00FF87]' : 'text-zinc-300'
                          }`}
                        >
                          <td className="px-5 py-3.5 font-mono text-xs tabular-nums">
                            {entry.rank <= 3 ? (
                              <span className="flex items-center gap-1">
                                <Trophy
                                  className={`h-3.5 w-3.5 ${
                                    entry.rank === 1
                                      ? 'text-yellow-400'
                                      : entry.rank === 2
                                        ? 'text-zinc-300'
                                        : 'text-orange-400'
                                  }`}
                                />
                                #{entry.rank}
                              </span>
                            ) : (
                              <span className="text-zinc-500">#{entry.rank}</span>
                            )}
                          </td>
                          <td className="px-5 py-3.5">
                            <Link
                              href={`/@${entry.githubHandle}`}
                              className="flex items-center gap-3"
                            >
                              {entry.avatarUrl ? (
                                <Image
                                  src={entry.avatarUrl}
                                  alt=""
                                  width={28}
                                  height={28}
                                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">
                                  {entry.githubHandle.substring(0, 2).toUpperCase()}
                                </div>
                              )}
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">@{entry.githubHandle}</span>
                                {isMe && (
                                  <span className="rounded-full bg-[#00FF87]/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-[#00FF87]">
                                    YOU
                                  </span>
                                )}
                              </div>
                            </Link>
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums">
                            {formatXp(entry.xp)} XP
                          </td>
                          <td className="px-5 py-3.5 text-right font-mono text-xs tabular-nums text-zinc-500">
                            {entry.githubTotalMerges}
                          </td>
                          <td className="px-5 py-3.5 text-right">
                            {entry.githubStreak > 0 ? (
                              <span className="inline-flex items-center gap-1 font-mono text-xs tabular-nums text-amber-400">
                                <Flame className="h-3 w-3" />
                                {entry.githubStreak}d
                              </span>
                            ) : (
                              <span className="font-mono text-xs text-zinc-600">--</span>
                            )}
                          </td>
                        </motion.tr>
                      );
                    })}
                  </tbody>
                </table>

                {userRankInfo && !userRankInfo.inView && (
                  <div className="border-t border-zinc-800 px-5 py-4">
                    <div className="text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
                      YOUR RANK
                    </div>
                    <div className="mt-2 flex items-center gap-3 text-[#00FF87]">
                      <span className="font-mono text-sm">#{userRankInfo.rank}</span>
                      <span className="text-sm">@{userHandle}</span>
                      <span className="font-mono text-xs">{formatXp(userXp)} XP</span>
                    </div>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Right Sidebar */}
      <aside className="hidden w-72 shrink-0 flex-col gap-6 border-l border-zinc-800 p-6 xl:flex">
        {userHandle && rivals.length > 0 && (
          <section>
            <div className="mb-3 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
              <Swords className="h-3.5 w-3.5" />
              Your Rivals
            </div>
            <div className="space-y-2">
              {rivals.map((rival) => (
                <div
                  key={rival.userId}
                  className="flex items-center justify-between rounded-lg border border-zinc-800 bg-zinc-900/50 px-4 py-3"
                >
                  <div className="flex items-center gap-2.5">
                    {rival.avatarUrl ? (
                      <Image
                        src={rival.avatarUrl}
                        alt=""
                        width={28}
                        height={28}
                        className="h-7 w-7 shrink-0 rounded-full object-cover"
                        unoptimized
                      />
                    ) : (
                      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500">
                        {rival.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div>
                      <div className="text-xs font-medium">@{rival.githubHandle}</div>
                      <div className="text-[10px] text-zinc-600">
                        {formatXp(rival.xp)} XP &bull; #{rival.rank}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Global Stats
          </div>
          <div className="space-y-3 rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">Contributors</span>
              <span className="font-mono text-sm tabular-nums text-zinc-300">
                {totalContributors.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-xs text-zinc-500">XP Shipped</span>
              <span className="font-mono text-sm tabular-nums text-zinc-300">
                {formatXp(totalXpShipped)} XP
              </span>
            </div>
          </div>
        </section>

        <section>
          <div className="mb-3 text-[11px] font-semibold uppercase tracking-wider text-zinc-500">
            Season Rewards
          </div>
          <div className="rounded-xl border border-zinc-800 bg-zinc-900/50 p-4">
            <div className="mb-2 flex items-center justify-between text-xs">
              <span className="text-zinc-400">Ends in</span>
              <span className="font-mono tabular-nums text-zinc-300">12d 14h</span>
            </div>
            <p className="mb-3 text-xs text-zinc-500">Top 100 get &apos;Founder&apos; badge</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-zinc-800">
              <div
                className="h-full rounded-full bg-[#00FF87]"
                style={{
                  width: `${Math.min((userRankInfo?.rank ?? 100) <= 100 ? ((101 - (userRankInfo?.rank ?? 101)) / 100) * 100 : 0, 100)}%`,
                  boxShadow: '0 0 8px rgba(0,255,135,0.4)',
                }}
              />
            </div>
            {userRankInfo && (
              <div className="mt-2 text-[10px] text-zinc-600">
                {userRankInfo.rank <= 100
                  ? 'You&apos;re in the top 100!'
                  : `#${userRankInfo.rank - 100} more to top 100`}
              </div>
            )}
          </div>
        </section>
      </aside>
    </div>
  );
}

function StatItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-[11px] uppercase tracking-wider text-zinc-500">{label}</span>
      <span className="font-mono text-xs tabular-nums text-zinc-300">{value}</span>
    </div>
  );
}

function PodiumCard({
  entry,
  position,
  gradient,
  shadow,
  height,
}: {
  entry: LeaderboardEntry;
  position: number;
  gradient: string;
  shadow: string;
  height: string;
}) {
  const formatXp = (xp: number) => {
    if (xp >= 1_000_000) return `${(xp / 1_000_000).toFixed(1)}M`;
    if (xp >= 1_000) return `${(xp / 1_000).toFixed(1)}K`;
    return xp.toLocaleString();
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, delay: position * 0.15 }}
      className={`flex w-36 flex-col items-center justify-end gap-2 rounded-t-2xl border border-zinc-800 bg-zinc-900/80 p-4 ${height} ${shadow}`}
    >
      <div className={`bg-gradient-to-b bg-clip-text text-transparent ${gradient}`}>
        <Trophy
          className={`h-6 w-6 ${position === 1 ? 'text-yellow-400' : position === 2 ? 'text-zinc-300' : 'text-orange-400'}`}
        />
      </div>
      {entry.avatarUrl ? (
        <Image
          src={entry.avatarUrl}
          alt=""
          width={32}
          height={32}
          className="h-8 w-8 rounded-full object-cover ring-2 ring-zinc-700"
          unoptimized
        />
      ) : (
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-[10px] text-zinc-500 ring-2 ring-zinc-700">
          {entry.githubHandle.substring(0, 2).toUpperCase()}
        </div>
      )}
      <div className="text-center">
        <div className="text-xs font-bold">@{entry.githubHandle}</div>
        <div className="font-mono text-[10px] tabular-nums text-zinc-400">
          {formatXp(entry.xp)} XP
        </div>
      </div>
    </motion.div>
  );
}
