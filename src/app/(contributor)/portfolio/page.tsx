import { Topbar } from "@/components/layout/Topbar";
import { currentUser } from "@/data/contributors";
import { allAchievements } from "@/data/achievements";
import { GitPullRequest, Star, MapPin, Calendar, ExternalLink, CheckCircle } from "lucide-react";

export default function PortfolioPage() {
  const user = currentUser;
  const skills = [
    { name: "TypeScript", level: 80 },
    { name: "React", level: 85 },
    { name: "CSS / Tailwind", level: 75 },
    { name: "Node.js", level: 60 },
    { name: "Testing", level: 45 },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="My Portfolio" subtitle="Public developer profile" />

      <div className="p-6 max-w-5xl space-y-6">
        {/* Profile card */}
        <div className="glass-card rounded-2xl p-8">
          <div className="flex items-start gap-6 flex-wrap">
            <div className="relative">
              <div className="w-20 h-20 rounded-2xl flex items-center justify-center font-display font-bold text-2xl text-white level-badge glow-purple">
                SS
              </div>
              <div className="absolute -bottom-1 -right-1 px-2 py-0.5 rounded-full text-xs font-bold level-badge">L3</div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-1">
                <h1 className="font-display text-3xl font-black text-white">{user.name}</h1>
                <span className="px-3 py-1 rounded-full text-sm font-bold"
                  style={{ background: "rgba(16,185,129,0.15)", color: "#34D399", border: "1px solid rgba(16,185,129,0.3)" }}>
                  ✓ Verified Contributor
                </span>
              </div>
              <p className="text-gray-400 mb-2">@{user.github}</p>
              <p className="mb-4" style={{ color: "#A0A0C0" }}>{user.bio}</p>
              <div className="flex items-center gap-6 text-sm flex-wrap" style={{ color: "#606080" }}>
                <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4" />Joined Sep 2024</span>
                <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4" />India</span>
                <span className="flex items-center gap-1.5"><GitPullRequest className="w-4 h-4" />{user.prsmerged} PRs merged</span>
                <span className="flex items-center gap-1.5"><Star className="w-4 h-4" />420 XP</span>
              </div>
            </div>

            <a href={`https://github.com/${user.github}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold btn-secondary">
              <ExternalLink className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <h2 className="font-display font-bold text-white">Stats</h2>
            {[
              { label: "Total XP", value: "420", color: "#A78BFA" },
              { label: "Current Level", value: "3 (INTERMEDIATE)", color: "#06B6D4" },
              { label: "Issues Solved", value: "12", color: "#10B981" },
              { label: "PRs Merged", value: "9", color: "#10B981" },
              { label: "Current Streak", value: "7 days 🔥", color: "#F59E0B" },
              { label: "Longest Streak", value: "14 days", color: "#F59E0B" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between">
                <span className="text-sm" style={{ color: "#A0A0C0" }}>{s.label}</span>
                <span className="text-sm font-semibold" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Skill bars */}
          <div className="glass-card rounded-2xl p-5 lg:col-span-2">
            <h2 className="font-display font-bold text-white mb-5">Skills</h2>
            <div className="space-y-4">
              {skills.map(skill => (
                <div key={skill.name}>
                  <div className="flex justify-between text-sm mb-1.5">
                    <span className="text-gray-300">{skill.name}</span>
                    <span style={{ color: "#A78BFA" }}>{skill.level}%</span>
                  </div>
                  <div className="xp-bar h-2.5">
                    <div className="xp-bar-fill h-full" style={{ width: `${skill.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contribution timeline */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-display font-bold text-white mb-5">Contribution History</h2>
          <div className="space-y-4">
            {user.contributions.map((c, i) => (
              <div key={i} className="flex items-start gap-4 relative">
                {i < user.contributions.length - 1 && (
                  <div className="absolute left-3.5 top-8 w-px h-full -z-0" style={{ background: "rgba(255,255,255,0.06)" }} />
                )}
                <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 z-10"
                  style={{
                    background: c.difficulty === "easy" ? "rgba(16,185,129,0.2)" : c.difficulty === "medium" ? "rgba(245,158,11,0.2)" : "rgba(239,68,68,0.2)",
                    border: `1px solid ${c.difficulty === "easy" ? "rgba(16,185,129,0.4)" : c.difficulty === "medium" ? "rgba(245,158,11,0.4)" : "rgba(239,68,68,0.4)"}`
                  }}>
                  <CheckCircle className="w-3.5 h-3.5" style={{ color: c.difficulty === "easy" ? "#10B981" : c.difficulty === "medium" ? "#F59E0B" : "#EF4444" }} />
                </div>
                <div className="flex-1 p-4 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <div className="flex items-center justify-between flex-wrap gap-2 mb-1">
                    <h3 className="font-medium text-white">{c.title}</h3>
                    <span className="text-sm font-bold" style={{ color: "#A78BFA" }}>+{c.xp} XP</span>
                  </div>
                  <p className="text-sm" style={{ color: "#606080" }}>{c.repo} · Merged {c.merged}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Achievements */}
        <div className="glass-card rounded-2xl p-6">
          <h2 className="font-display font-bold text-white mb-4">Achievements</h2>
          <div className="flex flex-wrap gap-3">
            {allAchievements.filter(a => a.unlocked).map(a => (
              <div key={a.id} className="flex items-center gap-2 px-3 py-2 rounded-xl text-sm"
                style={{ background: "rgba(124,58,237,0.12)", border: "1px solid rgba(124,58,237,0.25)", color: "#C4B5FD" }}>
                <span>{a.emoji}</span>
                <span className="font-medium">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
