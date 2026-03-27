import { Topbar } from "@/components/layout/Topbar";
import { allAchievements } from "@/data/achievements";
import { Lock } from "lucide-react";

export default function AchievementsPage() {
  const unlocked = allAchievements.filter(a => a.unlocked);
  const locked = allAchievements.filter(a => !a.unlocked);
  const totalXP = unlocked.reduce((sum, a) => sum + a.xpReward, 0);

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Achievements" subtitle="Your open source trophy room" />

      <div className="p-6 max-w-5xl space-y-8">
        {/* Summary */}
        <div className="glass-card rounded-2xl p-6 flex items-center gap-6 flex-wrap">
          <div className="text-center">
            <p className="stat-number text-4xl">{unlocked.length}</p>
            <p className="text-sm" style={{ color: "#A0A0C0" }}>Unlocked</p>
          </div>
          <div className="w-px h-12 hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="text-center">
            <p className="stat-number text-4xl">{locked.length}</p>
            <p className="text-sm" style={{ color: "#A0A0C0" }}>Remaining</p>
          </div>
          <div className="w-px h-12 hidden sm:block" style={{ background: "rgba(255,255,255,0.08)" }} />
          <div className="text-center">
            <p className="stat-number text-4xl">+{totalXP}</p>
            <p className="text-sm" style={{ color: "#A0A0C0" }}>XP Earned</p>
          </div>
          <div className="flex-1 min-w-48">
            <div className="flex justify-between text-xs mb-2" style={{ color: "#606080" }}>
              <span>Overall Progress</span>
              <span>{unlocked.length}/{allAchievements.length} achievements</span>
            </div>
            <div className="xp-bar h-3">
              <div className="xp-bar-fill h-full" style={{ width: `${(unlocked.length / allAchievements.length) * 100}%` }} />
            </div>
          </div>
        </div>

        {/* Unlocked */}
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
            🏆 Unlocked <span className="text-base text-gray-500 font-normal">({unlocked.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {unlocked.map(a => (
              <div key={a.id} className="glass-card rounded-2xl p-5 transition-card group"
                style={{ borderColor: "rgba(124,58,237,0.25)" }}>
                <div className="text-4xl mb-3">{a.emoji}</div>
                <h3 className="font-display font-bold text-white mb-1">{a.title}</h3>
                <p className="text-sm mb-4" style={{ color: "#A0A0C0" }}>{a.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#606080" }}>
                    {"unlockedAt" in a ? `Unlocked ${a.unlockedAt}` : ""}
                  </span>
                  <span className="text-xs px-2 py-1 rounded-full font-bold"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.3)" }}>
                    +{a.xpReward} XP
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Locked */}
        <div>
          <h2 className="font-display text-xl font-bold text-white mb-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-gray-500" /> In Progress
            <span className="text-base text-gray-500 font-normal">({locked.length})</span>
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {locked.map(a => (
              <div key={a.id} className="rounded-2xl p-5 transition-card"
                style={{ background: "rgba(255,255,255,0.02)", border: "1px solid rgba(255,255,255,0.05)" }}>
                <div className="text-4xl mb-3 opacity-40">{a.emoji}</div>
                <h3 className="font-display font-bold text-gray-400 mb-1">{a.title}</h3>
                <p className="text-sm mb-4" style={{ color: "#505068" }}>{a.description}</p>
                {"progress" in a && a.progress !== undefined && a.target && (
                  <div>
                    <div className="flex justify-between text-xs mb-1.5" style={{ color: "#505068" }}>
                      <span>Progress</span>
                      <span>{a.progress} / {a.target}</span>
                    </div>
                    <div className="xp-bar h-2">
                      <div className="xp-bar-fill h-full" style={{ width: `${Math.min((a.progress / a.target) * 100, 100)}%` }} />
                    </div>
                  </div>
                )}
                <div className="mt-3">
                  <span className="text-xs" style={{ color: "#404060" }}>
                    Reward: <span style={{ color: "#6050A0" }}>+{a.xpReward} XP</span>
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
