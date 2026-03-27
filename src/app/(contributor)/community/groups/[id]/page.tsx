import { Topbar } from "@/components/layout/Topbar";
import { mockGroups } from "@/data/communities";
import { notFound } from "next/navigation";
import Link from "next/link";
import { Users, MessageSquare, Clock, Star, ChevronLeft, Trophy } from "lucide-react";

export default function GroupDetailPage({ params }: { params: { id: string } }) {
  const group = mockGroups.find(g => g.id === params.id);
  if (!group) return notFound();

  const capacity = Math.round((group.members / group.maxMembers) * 100);
  const capacityColor = capacity >= 90 ? "#EF4444" : capacity >= 70 ? "#F59E0B" : "#10B981";

  const progressionReqs: Record<string, string[]> = {
    "first-steps": ["Reach Level 5", "3+ PRs merged", "500+ XP", "30 days in group"],
    "growing-developers": ["Reach Level 10", "15+ PRs merged", "2000+ XP", "60 days in group"],
    "code-masters": ["Expert level achieved", "50+ PRs merged", "5000+ XP"],
  };

  const quickActions = [
    { emoji: "❓", label: "Ask Question" },
    { emoji: "🐛", label: "Report Bug" },
    { emoji: "🔍", label: "Find Issue" },
    { emoji: "👥", label: "Find Buddy" },
    { emoji: "📚", label: "Learn Git" },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title={group.name} subtitle={`${group.emoji} Community Group`} />

      <div className="p-6 max-w-6xl space-y-6">
        {/* Back */}
        <Link href="/community" className="flex items-center gap-2 text-sm text-gray-500 hover:text-white transition-colors">
          <ChevronLeft className="w-4 h-4" /> Back to Groups
        </Link>

        {/* Group header */}
        <div className="glass-card rounded-2xl p-6">
          <div className="flex items-start justify-between flex-wrap gap-4">
            <div className="flex items-center gap-4">
              <span className="text-5xl">{group.emoji}</span>
              <div>
                <h1 className="font-display text-2xl font-bold text-white">{group.name}</h1>
                <p className="mt-1" style={{ color: "#A0A0C0" }}>{group.description}</p>
                <div className="flex flex-wrap gap-2 mt-3">
                  {group.tags.map(tag => (
                    <span key={tag} className="text-xs px-2.5 py-1 rounded-full"
                      style={{ background: "rgba(124,58,237,0.15)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.25)" }}>
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-center px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="stat-number text-2xl">{group.members}</p>
                <p className="text-xs" style={{ color: "#606080" }}>Members</p>
              </div>
              <div className="text-center px-4 py-3 rounded-xl" style={{ background: "rgba(255,255,255,0.04)" }}>
                <p className="stat-number text-2xl">{group.mentors.length}</p>
                <p className="text-xs" style={{ color: "#606080" }}>Mentors</p>
              </div>
            </div>
          </div>

          {/* Capacity */}
          <div className="mt-5">
            <div className="flex justify-between text-xs mb-1.5" style={{ color: "#606080" }}>
              <span>{group.members}/{group.maxMembers} members</span>
              <span style={{ color: capacityColor }}>{capacity}% full</span>
            </div>
            <div className="xp-bar h-2">
              <div className="h-full rounded-full" style={{ width: `${capacity}%`, background: `linear-gradient(90deg, ${capacityColor}, ${capacityColor}BB)` }} />
            </div>
          </div>

          {/* Celebration */}
          {group.recentCelebration && (
            <div className="mt-4 p-3 rounded-xl text-sm" style={{ background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.25)", color: "#6EE7B7" }}>
              {group.recentCelebration}
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left column */}
          <div className="lg:col-span-2 space-y-6">
            {/* Quick actions (beginner-friendly) */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-display font-bold text-white mb-4">Quick Actions</h2>
              <div className="flex flex-wrap gap-3">
                {quickActions.map(a => (
                  <button key={a.label} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium btn-secondary">
                    <span>{a.emoji}</span>{a.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Weekly challenge */}
            {group.weeklyChallenge && (
              <div className="glass-card rounded-2xl p-5" style={{ borderColor: "rgba(124,58,237,0.3)" }}>
                <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
                  <h2 className="font-display font-bold text-white flex items-center gap-2">
                    ⚡ Weekly Challenge
                    <span className="text-orange-400 text-sm font-normal">Ends in {group.weeklyChallenge.endsIn}</span>
                  </h2>
                  <span className="text-sm font-bold px-3 py-1 rounded-full"
                    style={{ background: "rgba(124,58,237,0.2)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.3)" }}>
                    +{group.weeklyChallenge.xpReward} XP for group
                  </span>
                </div>
                <h3 className="text-xl font-display font-bold text-white mb-1">{group.weeklyChallenge.title}</h3>
                <p className="text-sm mb-5" style={{ color: "#A0A0C0" }}>{group.weeklyChallenge.description}</p>
                <div className="flex justify-between text-sm mb-2">
                  <span style={{ color: "#A0A0C0" }}>Group Progress</span>
                  <span className="font-bold" style={{ color: "#A78BFA" }}>{group.weeklyChallenge.progress}/{group.weeklyChallenge.goal}</span>
                </div>
                <div className="xp-bar h-3">
                  <div className="xp-bar-fill h-full" style={{ width: `${(group.weeklyChallenge.progress / group.weeklyChallenge.goal) * 100}%` }} />
                </div>
              </div>
            )}

            {/* Top members */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Trophy className="w-4 h-4 text-amber-400" /> Top Members
              </h2>
              <div className="space-y-3">
                {group.topMembers.map((m, i) => (
                  <div key={m.name} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <span className="text-base font-bold w-5" style={{ color: ["#F59E0B", "#9CA3AF", "#78716C"][i] }}>
                      {["1st", "2nd", "3rd"][i]}
                    </span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white level-badge">{m.avatar}</div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{m.name}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold" style={{ color: "#A78BFA" }}>{m.xp} XP</p>
                      <p className="text-xs" style={{ color: "#606080" }}>L{m.level}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right sidebar */}
          <div className="space-y-5">
            {/* Mentors */}
            {group.mentors.length > 0 && (
              <div className="glass-card rounded-2xl p-5">
                <h2 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                  🎓 Mentors
                </h2>
                {group.mentors.map(mentor => (
                  <div key={mentor.name} className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white level-badge">{mentor.avatar}</div>
                      <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-online" style={{ borderColor: "#0D0D1A" }} />
                    </div>
                    <div className="flex-1">
                      <p className="text-sm font-semibold text-white">{mentor.name}</p>
                      <p className="text-xs flex items-center gap-1" style={{ color: "#10B981" }}>
                        <Clock className="w-3 h-3" />Avg: {mentor.responseTime}
                      </p>
                    </div>
                    <button className="px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary">Ask</button>
                  </div>
                ))}
              </div>
            )}

            {/* Progression requirements */}
            {progressionReqs[group.id] && (
              <div className="glass-card rounded-2xl p-5">
                <h2 className="font-display font-bold text-white mb-4">Graduate to Next Level</h2>
                <div className="space-y-2">
                  {progressionReqs[group.id].map(req => (
                    <div key={req} className="flex items-center gap-2 text-sm" style={{ color: "#A0A0C0" }}>
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: "rgba(124,58,237,0.5)" }} />
                      {req}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Buddy system */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-display font-bold text-white mb-3">👥 Buddy System</h2>
              <p className="text-sm mb-4" style={{ color: "#A0A0C0" }}>Get paired with a contributor at the same level for accountability and peer learning.</p>
              <button className="w-full py-2.5 rounded-xl text-sm font-semibold btn-secondary">Find My Buddy</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export async function generateStaticParams() {
  return [
    { id: "first-steps" },
    { id: "growing-developers" },
    { id: "code-masters" },
    { id: "js-enthusiasts" },
    { id: "react-community" },
    { id: "python-devs" },
  ];
}
