'use client';

import { X, Flame, GitPullRequest, Award } from 'lucide-react';
import { type LeaderboardEntry } from '@/app/actions/leaderboard';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  user: LeaderboardEntry;
  rival: LeaderboardEntry;
};

export function DuelModal({ isOpen, onClose, user, rival }: Props) {
  if (!isOpen) return null;

  const maxVal = Math.max(user.xp, rival.xp, 100);
  const userXpPct = Math.max(10, Math.min(100, Math.floor((user.xp / maxVal) * 105)));
  const rivalXpPct = Math.max(10, Math.min(100, Math.floor((rival.xp / maxVal) * 105)));

  const maxPR = Math.max(user.mergedPRs, rival.mergedPRs, 1);
  const userPrPct = Math.max(10, Math.min(100, Math.floor((user.mergedPRs / maxPR) * 105)));
  const rivalPrPct = Math.max(10, Math.min(100, Math.floor((rival.mergedPRs / maxPR) * 105)));

  const maxStreak = Math.max(user.streak, rival.streak, 1);
  const userStreakPct = Math.max(10, Math.min(100, Math.floor((user.streak / maxStreak) * 105)));
  const rivalStreakPct = Math.max(10, Math.min(100, Math.floor((rival.streak / maxStreak) * 105)));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 font-mono backdrop-blur-sm">
      <div className="animate-in fade-in zoom-in w-full max-w-2xl overflow-hidden rounded-xl border border-zinc-800 bg-[#0D0E12] text-white shadow-2xl duration-200">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-zinc-800 bg-zinc-950 px-6 py-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-[#00FF87]">
            RIVAL DUEL COMPARISON
          </h3>
          <button onClick={onClose} className="text-zinc-500 transition-colors hover:text-white">
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Comparison Area */}
        <div className="space-y-8 p-8">
          <div className="grid grid-cols-2 gap-8 text-center">
            {/* User */}
            <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-6 shadow-[0_0_20px_rgba(0,255,135,0.02)]">
              <span className="absolute left-3 top-3 text-[10px] font-bold text-zinc-500">YOU</span>
              {user.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={user.avatarUrl}
                  alt=""
                  className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-[#00FF87]/50 shadow-[0_0_15px_rgba(0,255,135,0.1)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="bg-zinc-850 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-[#00FF87]/50 font-bold text-[#00FF87]">
                  {user.githubHandle.substring(0, 2).toUpperCase()}
                </div>
              )}
              <h4 className="truncate text-base font-bold">@{user.githubHandle}</h4>
              <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
                Rank #{user.rank}
              </p>
            </div>

            {/* Rival */}
            <div className="relative rounded-xl border border-zinc-800/80 bg-zinc-900/20 p-6 shadow-[0_0_20px_rgba(239,68,68,0.02)]">
              <span className="absolute right-3 top-3 text-[10px] font-bold text-red-500">
                RIVAL
              </span>
              {rival.avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={rival.avatarUrl}
                  alt=""
                  className="mx-auto mb-4 h-16 w-16 rounded-full border-2 border-red-500/50 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="bg-zinc-850 mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full border-2 border-red-500/50 font-bold text-red-400">
                  {rival.githubHandle.substring(0, 2).toUpperCase()}
                </div>
              )}
              <h4 className="truncate text-base font-bold">@{rival.githubHandle}</h4>
              <p className="mt-1 text-xs uppercase tracking-widest text-zinc-500">
                Rank #{rival.rank}
              </p>
            </div>
          </div>

          {/* Stats Breakdown */}
          <div className="space-y-6">
            {/* XP Bar */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-zinc-400">
                <span>{user.xp.toLocaleString()} XP</span>
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  <Award className="h-3.5 w-3.5" /> TOTAL EXPERIENCE
                </span>
                <span>{rival.xp.toLocaleString()} XP</span>
              </div>
              <div className="flex h-6 items-center gap-2 overflow-hidden rounded-sm border border-zinc-900 bg-zinc-950/80 p-0.5">
                <div
                  style={{ width: `${userXpPct / 2}%` }}
                  className="h-full rounded-sm bg-[#00FF87] transition-all duration-500"
                />
                <div className="flex-1" />
                <div
                  style={{ width: `${rivalXpPct / 2}%` }}
                  className="h-full animate-pulse rounded-sm bg-red-500 transition-all duration-500"
                />
              </div>
            </div>

            {/* Merged PRs */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-zinc-400">
                <span>{user.mergedPRs} Merged</span>
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  <GitPullRequest className="h-3.5 w-3.5" /> MERGED PULL REQUESTS
                </span>
                <span>{rival.mergedPRs} Merged</span>
              </div>
              <div className="flex h-6 items-center gap-2 overflow-hidden rounded-sm border border-zinc-900 bg-zinc-950/80 p-0.5">
                <div
                  style={{ width: `${userPrPct / 2}%` }}
                  className="h-full rounded-sm bg-[#00FF87] transition-all duration-500"
                />
                <div className="flex-1" />
                <div
                  style={{ width: `${rivalPrPct / 2}%` }}
                  className="h-full rounded-sm bg-red-500 transition-all duration-500"
                />
              </div>
            </div>

            {/* Streak */}
            <div className="space-y-2">
              <div className="flex justify-between text-xs font-bold text-zinc-400">
                <span>{user.streak} Days</span>
                <span className="flex items-center gap-1 text-[10px] uppercase tracking-widest text-zinc-500">
                  <Flame className="h-3.5 w-3.5" /> ACTIVE STREAK
                </span>
                <span>{rival.streak} Days</span>
              </div>
              <div className="flex h-6 items-center gap-2 overflow-hidden rounded-sm border border-zinc-900 bg-zinc-950/80 p-0.5">
                <div
                  style={{ width: `${userStreakPct / 2}%` }}
                  className="h-full rounded-sm bg-[#00FF87] transition-all duration-500"
                />
                <div className="flex-1" />
                <div
                  style={{ width: `${rivalStreakPct / 2}%` }}
                  className="h-full rounded-sm bg-red-500 transition-all duration-500"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end border-t border-zinc-800 bg-zinc-950 px-6 py-4">
          <button
            onClick={onClose}
            className="border border-zinc-700 px-6 py-2 text-xs font-bold uppercase tracking-widest text-white transition-colors hover:bg-zinc-800"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
