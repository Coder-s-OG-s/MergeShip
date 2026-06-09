'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Trophy, Flame, GitPullRequest, Award, Users, Hourglass, Swords, Zap } from 'lucide-react';
import { type LeaderboardEntry, type LeaderboardScope } from '@/app/actions/leaderboard';
import { DuelModal } from './duel-modal';

type Props = {
  entries: LeaderboardEntry[];
  currentUserRank: LeaderboardEntry | null;
  rivalAbove: LeaderboardEntry | null;
  rivalBelow: LeaderboardEntry | null;
  totalContributors: number;
  totalXpShipped: number;
  currentScope: LeaderboardScope;
  currentUser: { id: string; githubHandle: string; xp: number } | null;
};

export function LeaderboardClient({
  entries,
  currentUserRank,
  rivalAbove,
  rivalBelow,
  totalContributors,
  totalXpShipped,
  currentScope,
  currentUser,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [duelTarget, setDuelTarget] = useState<LeaderboardEntry | null>(null);

  const firstPlace = entries[0] ?? null;
  const secondPlace = entries[1] ?? null;
  const thirdPlace = entries[2] ?? null;

  const handleScopeChange = (scope: LeaderboardScope) => {
    startTransition(() => {
      router.push(`/leaderboard?scope=${scope}`);
    });
  };

  function formatXP(xp: number): string {
    if (xp >= 1_000_000) {
      return `${(xp / 1_000_000).toFixed(1)}M XP`;
    }
    if (xp >= 1_000) {
      return `${(xp / 1_000).toFixed(1)}k XP`;
    }
    return `${xp} XP`;
  }

  // Calculate user rank percent
  const rank = currentUserRank?.rank ?? 1;
  const topPercent = Math.max(1, Math.ceil((rank / Math.max(totalContributors, 1)) * 100));

  // Season progress towards mock milestone (e.g. 5,000 XP)
  const milestoneXP = 5000;
  const userXP = currentUser?.xp ?? 0;
  const progressPct = Math.min(100, Math.floor((userXP / milestoneXP) * 100));

  return (
    <div className="flex min-h-screen bg-[#0D0E12] font-mono text-white">
      {/* Center Main Area */}
      <div className="flex-1 overflow-y-auto p-8 lg:p-12">
        <header className="mb-10 flex flex-col justify-between gap-6 border-b border-zinc-800 pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
              02 / LEADERBOARD
            </div>
            <h1 className="font-serif text-4xl text-white">Leaderboard</h1>
            {currentUser && (
              <div className="mt-2 text-xs uppercase tracking-wider text-zinc-400">
                YOUR RANK: <span className="font-bold text-[#00FF87]">#{rank}</span> •{' '}
                <span className="text-zinc-300">TOP {topPercent}%</span>
              </div>
            )}
          </div>

          {/* Scope Tabs */}
          <div className="flex flex-wrap gap-1 rounded-sm border border-zinc-800 bg-zinc-950 p-1">
            {(['global', 'monthly', 'organization', 'friends'] as LeaderboardScope[]).map(
              (scope) => (
                <button
                  key={scope}
                  onClick={() => handleScopeChange(scope)}
                  disabled={isPending}
                  className={`rounded-sm px-4 py-2 text-[11px] font-bold uppercase tracking-wider transition-colors ${
                    currentScope === scope
                      ? 'bg-zinc-900 text-[#00FF87]'
                      : 'text-zinc-500 hover:text-white'
                  }`}
                >
                  {scope}
                </button>
              ),
            )}
          </div>
        </header>

        {isPending ? (
          <div className="flex h-64 items-center justify-center text-zinc-500">
            <span className="animate-pulse">LOADING METRICS...</span>
          </div>
        ) : (
          <>
            {/* Top 3 Podium Display */}
            <div className="mx-auto my-10 flex max-w-4xl flex-col items-end justify-center gap-6 md:flex-row">
              {/* 2nd Place */}
              <div className="relative flex h-48 w-full flex-col items-center justify-between rounded-xl border border-t-2 border-zinc-800/80 border-t-zinc-400 bg-zinc-900/20 p-5 shadow-[0_0_15px_rgba(226,232,240,0.02)] md:w-56">
                <div className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">
                  2nd Place
                </div>
                {secondPlace ? (
                  <>
                    {secondPlace.avatarUrl ? (
                      <img
                        src={secondPlace.avatarUrl}
                        alt=""
                        className="h-12 w-12 rounded-full border border-zinc-800"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-400">
                        {secondPlace.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <Link
                      href={`/@${secondPlace.githubHandle}`}
                      className="truncate text-sm font-bold hover:underline"
                    >
                      @{secondPlace.githubHandle}
                    </Link>
                    <div className="text-xs font-bold text-zinc-400">
                      {formatXP(secondPlace.xp)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] uppercase tracking-widest text-zinc-600">Empty</div>
                )}
              </div>

              {/* 1st Place */}
              <div className="relative -top-3 flex h-56 w-full flex-col items-center justify-between rounded-xl border border-t-4 border-zinc-800 border-t-yellow-400 bg-zinc-900/30 p-6 shadow-[0_0_30px_rgba(234,179,8,0.1)] md:w-64">
                <div className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-yellow-400">
                  🏆 1st Place
                </div>
                {firstPlace ? (
                  <>
                    {firstPlace.avatarUrl ? (
                      <img
                        src={firstPlace.avatarUrl}
                        alt=""
                        className="h-16 w-16 rounded-full border-2 border-yellow-500/50 shadow-[0_0_15px_rgba(234,179,8,0.15)]"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-16 w-16 items-center justify-center rounded-full border-2 border-yellow-500/50 bg-zinc-800 font-bold text-yellow-500">
                        {firstPlace.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <Link
                      href={`/@${firstPlace.githubHandle}`}
                      className="truncate text-base font-bold hover:underline"
                    >
                      @{firstPlace.githubHandle}
                    </Link>
                    <div className="text-sm font-bold text-[#00FF87]">
                      {formatXP(firstPlace.xp)}
                    </div>
                  </>
                ) : (
                  <div className="text-[11px] uppercase tracking-widest text-zinc-600">Empty</div>
                )}
              </div>

              {/* 3rd Place */}
              <div className="relative flex h-40 w-full flex-col items-center justify-between rounded-xl border border-t-2 border-zinc-800/80 border-t-amber-700 bg-zinc-900/20 p-5 shadow-[0_0_15px_rgba(251,191,36,0.02)] md:w-56">
                <div className="text-[10px] font-bold uppercase tracking-widest text-amber-700">
                  3rd Place
                </div>
                {thirdPlace ? (
                  <>
                    {thirdPlace.avatarUrl ? (
                      <img
                        src={thirdPlace.avatarUrl}
                        alt=""
                        className="h-10 w-10 rounded-full border border-zinc-800"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-zinc-800 font-bold text-zinc-500">
                        {thirdPlace.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <Link
                      href={`/@${thirdPlace.githubHandle}`}
                      className="truncate text-sm font-bold hover:underline"
                    >
                      @{thirdPlace.githubHandle}
                    </Link>
                    <div className="text-xs font-bold text-zinc-400">{formatXP(thirdPlace.xp)}</div>
                  </>
                ) : (
                  <div className="text-[11px] uppercase tracking-widest text-zinc-600">Empty</div>
                )}
              </div>
            </div>

            {/* Rankings Table */}
            <div className="mt-12 overflow-x-auto rounded-sm border border-zinc-800 bg-zinc-950/20">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="border-b border-zinc-800 text-[10px] uppercase tracking-widest text-zinc-500">
                    <th className="px-6 py-4">Rank</th>
                    <th className="px-6 py-4">Contributor</th>
                    <th className="px-6 py-4">XP</th>
                    <th className="px-6 py-4">Merged</th>
                    <th className="px-6 py-4">Streak</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-900/50">
                  {entries.map((entry) => {
                    const isMe = entry.githubHandle === currentUser?.githubHandle;
                    return (
                      <tr
                        key={entry.userId}
                        className={`transition-colors ${
                          isMe
                            ? 'border-y border-[#00FF87]/20 bg-[#00FF87]/5 font-bold text-[#00FF87]'
                            : 'hover:bg-zinc-900/30'
                        }`}
                      >
                        <td className="px-6 py-4">#{entry.rank}</td>
                        <td className="flex items-center gap-3 px-6 py-4">
                          {entry.avatarUrl ? (
                            <img
                              src={entry.avatarUrl}
                              alt=""
                              className="h-6 w-6 rounded-full border border-zinc-800"
                              referrerPolicy="no-referrer"
                            />
                          ) : (
                            <div className="flex h-6 w-6 items-center justify-center rounded-full bg-zinc-800 text-[10px] font-bold text-zinc-500">
                              {entry.githubHandle.substring(0, 2).toUpperCase()}
                            </div>
                          )}
                          <Link href={`/@${entry.githubHandle}`} className="hover:underline">
                            @{entry.githubHandle}
                          </Link>
                          {isMe && <span className="text-[10px] text-[#00FF87]">(YOU)</span>}
                        </td>
                        <td className="px-6 py-4">{entry.xp.toLocaleString()} XP</td>
                        <td className="px-6 py-4">{entry.mergedPRs} Merged</td>
                        <td className="flex items-center gap-1 px-6 py-4">
                          <span>{entry.streak}</span>
                          {entry.streak > 0 && (
                            <Flame className="h-3.5 w-3.5 fill-orange-500 text-orange-500" />
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>

      {/* Right Sidebar */}
      <div className="hidden w-80 shrink-0 flex-col gap-10 overflow-y-auto border-l border-zinc-800 bg-[#0B0C0E]/50 p-8 xl:flex">
        {/* Your Rivals */}
        {currentUserRank && (rivalAbove || rivalBelow) ? (
          <div>
            <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2">
              <Swords className="h-4 w-4 text-[#00FF87]" />
              <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
                YOUR RIVALS
              </h2>
            </div>
            <div className="space-y-4">
              {/* Rival Above */}
              {rivalAbove && (
                <div className="flex items-center justify-between gap-3 rounded-sm border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {rivalAbove.avatarUrl ? (
                      <img
                        src={rivalAbove.avatarUrl}
                        alt=""
                        className="border-zinc-850 h-8 w-8 rounded-full border"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-500">
                        {rivalAbove.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="truncate text-xs font-bold">@{rivalAbove.githubHandle}</div>
                      <div className="text-[10px] text-zinc-500">
                        #{rivalAbove.rank} • {rivalAbove.xp.toLocaleString()} XP
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDuelTarget(rivalAbove)}
                    className="border border-[#00FF87]/30 px-3.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#00FF87] transition-all hover:border-[#00FF87] hover:bg-[#00FF87]/10"
                  >
                    DUEL
                  </button>
                </div>
              )}

              {/* Self */}
              <div className="flex items-center gap-3 rounded-sm border border-[#00FF87]/20 bg-[#00FF87]/5 p-4">
                {currentUserRank.avatarUrl ? (
                  <img
                    src={currentUserRank.avatarUrl}
                    alt=""
                    className="h-8 w-8 rounded-full border border-[#00FF87]/30"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-[#00FF87]">
                    {currentUserRank.githubHandle.substring(0, 2).toUpperCase()}
                  </div>
                )}
                <div className="overflow-hidden">
                  <div className="truncate text-xs font-bold text-[#00FF87]">
                    @{currentUserRank.githubHandle} (YOU)
                  </div>
                  <div className="text-[10px] text-zinc-400">
                    #{currentUserRank.rank} • {currentUserRank.xp.toLocaleString()} XP
                  </div>
                </div>
              </div>

              {/* Rival Below */}
              {rivalBelow && (
                <div className="flex items-center justify-between gap-3 rounded-sm border border-zinc-800/80 bg-zinc-950/40 p-4 shadow-[0_2px_10px_rgba(0,0,0,0.2)]">
                  <div className="flex items-center gap-3 overflow-hidden">
                    {rivalBelow.avatarUrl ? (
                      <img
                        src={rivalBelow.avatarUrl}
                        alt=""
                        className="border-zinc-850 h-8 w-8 rounded-full border"
                        referrerPolicy="no-referrer"
                      />
                    ) : (
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-zinc-800 text-xs font-bold text-zinc-500">
                        {rivalBelow.githubHandle.substring(0, 2).toUpperCase()}
                      </div>
                    )}
                    <div className="overflow-hidden">
                      <div className="truncate text-xs font-bold">@{rivalBelow.githubHandle}</div>
                      <div className="text-[10px] text-zinc-500">
                        #{rivalBelow.rank} • {rivalBelow.xp.toLocaleString()} XP
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setDuelTarget(rivalBelow)}
                    className="border border-[#00FF87]/30 px-3.5 py-1 text-[9px] font-bold uppercase tracking-wider text-[#00FF87] transition-all hover:border-[#00FF87] hover:bg-[#00FF87]/10"
                  >
                    DUEL
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : null}

        {/* Global Stats */}
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Users className="h-4 w-4 text-[#00FF87]" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              GLOBAL STATS
            </h2>
          </div>
          <div className="space-y-4 text-xs">
            <div className="flex justify-between border-b border-zinc-900 py-2">
              <span className="text-zinc-500">TOTAL CONTRIBUTORS</span>
              <span className="font-bold">{totalContributors}</span>
            </div>
            <div className="flex justify-between border-b border-zinc-900 py-2">
              <span className="text-zinc-500">TOTAL XP SHIPPED</span>
              <span className="font-bold">{totalXpShipped.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Season Rewards Tracker */}
        <div>
          <div className="mb-4 flex items-center gap-2 border-b border-zinc-800 pb-2">
            <Hourglass className="h-4 w-4 text-[#00FF87]" />
            <h2 className="text-[11px] font-bold uppercase tracking-widest text-zinc-400">
              SEASON REWARDS
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between text-[10px] font-bold">
              <span className="uppercase tracking-wider text-zinc-500">SEASON 1 Rewards</span>
              <span className="flex items-center gap-1 uppercase tracking-widest text-orange-500">
                <Zap className="h-3 w-3 fill-orange-500" /> Ends in 12d 14h
              </span>
            </div>
            <p className="text-[11px] leading-relaxed text-zinc-400">
              Top 100 players this season earn the exclusive{' '}
              <span className="font-bold text-[#00FF87]">Founder</span> badge on their profile.
            </p>
            <div className="space-y-1">
              <div className="flex justify-between text-[10px] text-zinc-500">
                <span>PROGRESS</span>
                <span>
                  {userXP.toLocaleString()} / {milestoneXP.toLocaleString()} XP
                </span>
              </div>
              <div className="h-1.5 w-full overflow-hidden rounded-full border border-zinc-900 bg-zinc-950">
                <div
                  style={{ width: `${progressPct}%` }}
                  className="h-full rounded-full bg-[#00FF87] transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Interactive Duel Modal */}
      {currentUserRank && duelTarget && (
        <DuelModal
          isOpen={!!duelTarget}
          onClose={() => setDuelTarget(null)}
          user={currentUserRank}
          rival={duelTarget}
        />
      )}
    </div>
  );
}
