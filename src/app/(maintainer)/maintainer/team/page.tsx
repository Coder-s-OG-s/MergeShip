"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { mockTeamMembers } from "@/data/maintainers";
import {
  TrendingDown, TrendingUp, AlertTriangle, GitPullRequest,
  CheckCircle, Clock, Star, Users, ChevronRight, Zap
} from "lucide-react";

const recentActivity: Record<string, { type: string; desc: string; time: string }[]> = {
  m001: [
    { type: "merge", desc: "Merged PR #1847 — RSC fix", time: "2m ago" },
    { type: "close", desc: "Closed 3 stale issues", time: "15m ago" },
    { type: "review", desc: "Requested changes on #1843", time: "1h ago" },
  ],
  m002: [
    { type: "review", desc: "Reviewed PR #1843 — hydration error", time: "22m ago" },
    { type: "assign", desc: "Assigned issue #2031 to Mike", time: "2h ago" },
  ],
  m003: [
    { type: "open", desc: "Opened PR #412 — SWR generics", time: "4h ago" },
    { type: "close", desc: "Closed 2 issues in vercel/ai", time: "5h ago" },
  ],
  m004: [
    { type: "comment", desc: "Left comment on issue #2028", time: "3h ago" },
  ],
};

const activityTypeColor: Record<string, string> = {
  merge: "#10B981", close: "#06B6D4", review: "#F59E0B",
  assign: "#A78BFA", open: "#EF4444", comment: "#EC4899",
};

export default function TeamPage() {
  const [expanded, setExpanded] = useState<string | null>(null);
  const overloaded = mockTeamMembers.filter(m => m.workloadPercent > 85);
  const underloaded = mockTeamMembers.filter(m => m.workloadPercent < 50);

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Team & Workload" subtitle="Real-time member stats and load balancing" />

      <div className="p-6 max-w-6xl space-y-6">

        {/* Rebalance banner */}
        {overloaded.length > 0 && underloaded.length > 0 && (
          <div className="flex items-center gap-3 p-4 rounded-xl" style={{ background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.3)" }}>
            <Zap className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <p className="text-sm flex-1" style={{ color: "#FCD34D" }}>
              <strong>{overloaded[0].name}</strong> is overloaded ({overloaded[0].currentIssues} issues).{" "}
              Consider reassigning 3 issues to <strong>{underloaded[0].name}</strong> who has capacity.
            </p>
            <button className="ml-auto flex-shrink-0 px-4 py-2 rounded-lg text-sm font-semibold" style={{ background: "rgba(245,158,11,0.2)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.4)" }}>
              Auto-Rebalance
            </button>
          </div>
        )}

        {/* Summary row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Total Members", value: mockTeamMembers.length, color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.2)", icon: Users },
            { label: "Online Now", value: mockTeamMembers.filter(m => m.status === "online").length, color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)", icon: CheckCircle },
            { label: "Overloaded", value: overloaded.length, color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.2)", icon: AlertTriangle },
            { label: "Avg Workload", value: `${Math.round(mockTeamMembers.reduce((a, m) => a + m.workloadPercent, 0) / mockTeamMembers.length)}%`, color: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.2)", icon: TrendingUp },
          ].map(s => (
            <div key={s.label} className="glass-card rounded-2xl p-4 transition-card" style={{ borderColor: s.border }}>
              <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3" style={{ background: s.bg }}>
                <s.icon className="w-4 h-4" style={{ color: s.color }} />
              </div>
              <p className="stat-number text-3xl mb-0.5">{s.value}</p>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#606080" }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Team cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {mockTeamMembers.map(m => {
            const isOverloaded = m.workloadPercent > 80;
            const isUnder = m.workloadPercent < 50;
            const workloadColor = isOverloaded ? "#EF4444" : isUnder ? "#10B981" : "#F59E0B";
            const isExpanded = expanded === m.id;

            return (
              <div key={m.id} className="glass-card rounded-2xl p-5 transition-card" style={{ cursor: "pointer" }}
                onClick={() => setExpanded(isExpanded ? null : m.id)}>

                {/* Header */}
                <div className="flex items-center gap-4 mb-4">
                  <div className="relative">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center font-bold text-white level-badge text-sm">{m.avatar}</div>
                    <div className={`absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 status-${m.status}`} style={{ borderColor: "#060611" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display font-bold text-white">{m.name}</p>
                    <p className="text-xs" style={{ color: "#606080" }}>{m.role}</p>
                    <p className="text-xs mt-0.5 truncate" style={{ color: "#404060" }}>{m.repos.join(", ")}</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <div className="flex items-center gap-1 text-xs justify-end" style={{ color: workloadColor }}>
                      {isOverloaded ? <TrendingUp className="w-3 h-3" /> : isUnder ? <TrendingDown className="w-3 h-3" /> : null}
                      <span className="font-semibold capitalize">
                        {isOverloaded ? "Overloaded" : isUnder ? "Available" : "Optimal"}
                      </span>
                    </div>
                    <p className="text-xs mt-0.5" style={{ color: "#606080" }}>{m.currentIssues} active issues</p>
                  </div>
                </div>

                {/* Workload bar */}
                <div className="mb-4">
                  <div className="flex justify-between text-xs mb-1.5" style={{ color: "#606080" }}>
                    <span>Workload</span>
                    <span className="font-semibold" style={{ color: workloadColor }}>{m.workloadPercent}%</span>
                  </div>
                  <div className="xp-bar h-2">
                    <div className="h-full rounded-full transition-all" style={{
                      width: `${m.workloadPercent}%`,
                      background: `linear-gradient(90deg, ${workloadColor}, ${workloadColor}AA)`
                    }} />
                  </div>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3 mb-3">
                  {[
                    { label: "Resolved", value: m.issuesResolved, color: "#10B981" },
                    { label: "Avg Response", value: m.avgResponseTime, color: "#06B6D4" },
                    { label: "Quality", value: `${m.qualityScore}%`, color: "#A78BFA" },
                  ].map(s => (
                    <div key={s.label} className="text-center p-2 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                      <p className="font-display font-bold text-base" style={{ color: s.color }}>{s.value}</p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#606080" }}>{s.label}</p>
                    </div>
                  ))}
                </div>

                {/* Expand toggle */}
                <div className="flex items-center justify-between">
                  <span className="text-xs" style={{ color: "#606080" }}>
                    {isExpanded ? "Hide activity" : "Show recent activity"}
                  </span>
                  <ChevronRight className={`w-4 h-4 text-gray-500 transition-transform ${isExpanded ? "rotate-90" : ""}`} />
                </div>

                {/* Expandable activity */}
                {isExpanded && (
                  <div className="mt-4 pt-4 space-y-2" style={{ borderTop: "1px solid rgba(255,255,255,0.06)" }}>
                    {(recentActivity[m.id] || []).map((a, i) => (
                      <div key={i} className="flex items-center gap-2 text-xs">
                        <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: activityTypeColor[a.type] || "#606080" }} />
                        <span className="flex-1" style={{ color: "#A0A0C0" }}>{a.desc}</span>
                        <span style={{ color: "#606080" }}>{a.time}</span>
                      </div>
                    ))}
                    <div className="flex gap-2 mt-3">
                      <button className="flex-1 py-1.5 rounded-lg text-xs btn-secondary">Assign Issues</button>
                      <button className="flex-1 py-1.5 rounded-lg text-xs btn-secondary">View Profile</button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
