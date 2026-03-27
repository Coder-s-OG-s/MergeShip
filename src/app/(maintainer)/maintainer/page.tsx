"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { mockPriorityIssues, mockTeamMembers, mockStaleIssues, mockAnalytics } from "@/data/maintainers";
import {
  AlertTriangle, TrendingUp, Users, GitPullRequest, Clock,
  CheckCircle, Tag, MessageSquare, ExternalLink, Activity,
  Zap, GitMerge, Star, ArrowUpRight, Shield
} from "lucide-react";

const priorityConfig = {
  critical: { label: "Critical", cls: "priority-critical" },
  high: { label: "High", cls: "priority-high" },
  medium: { label: "Medium", cls: "priority-medium" },
  low: { label: "Low", cls: "priority-low" },
};

const categoryColors: Record<string, string> = {
  Bug: "rgba(239,68,68,0.15)",
  Feature: "rgba(6,182,212,0.15)",
  Duplicate: "rgba(245,158,11,0.15)",
  Question: "rgba(124,58,237,0.15)",
  Docs: "rgba(16,185,129,0.15)",
};
const categoryTextColors: Record<string, string> = {
  Bug: "#FCA5A5", Feature: "#67E8F9", Duplicate: "#FCD34D",
  Question: "#C4B5FD", Docs: "#6EE7B7",
};

const activityFeed = [
  { type: "merge", user: "alice_dev", action: "merged PR #1847", repo: "vercel/next.js", time: "2m ago", color: "#10B981", icon: GitMerge },
  { type: "open", user: "dev_raj", action: "opened issue #2031", repo: "vercel/swr", time: "8m ago", color: "#06B6D4", icon: AlertTriangle },
  { type: "close", user: "Alex Chen", action: "closed 3 stale issues", repo: "vercel/turbo", time: "15m ago", color: "#A78BFA", icon: CheckCircle },
  { type: "review", user: "Jenny Park", action: "requested changes on PR #1843", repo: "vercel/next.js", time: "22m ago", color: "#F59E0B", icon: GitPullRequest },
  { type: "star", user: "css_wizard", action: "left a comment on issue #2028", repo: "tailwindlabs/tailwindcss", time: "31m ago", color: "#EC4899", icon: MessageSquare },
];

const openPRs = [
  { id: 1847, title: "Fix RSC serialization edge case for circular refs", author: "alice_dev", reviewers: ["AC", "JP"], additions: 142, deletions: 38, status: "approved", repo: "vercel/next.js" },
  { id: 1843, title: "Improve hydration error messaging with diff view", author: "pro_coder42", reviewers: ["MT"], additions: 87, deletions: 22, status: "changes_requested", repo: "vercel/next.js" },
  { id: 412, title: "Add useSWRSubscription TypeScript generics", author: "css_wizard", reviewers: [], additions: 54, deletions: 11, status: "pending", repo: "vercel/swr" },
];

const prStatusConfig = {
  approved: { label: "Approved", color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  changes_requested: { label: "Changes Requested", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  pending: { label: "Awaiting Review", color: "#606080", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
};

export default function MaintainerDashboardPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "prs">("queue");
  const online = mockTeamMembers.filter(m => m.status === "online").length;
  const urgent = mockPriorityIssues.filter(i => i.priority === "critical" || i.priority === "high").length;

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Command Center" subtitle="Managing vercel/* repositories" />

      <div className="p-6 max-w-7xl space-y-6">

        {/* KPI Banner */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: "Urgent Issues", value: urgent, sub: "Critical + High", icon: AlertTriangle, color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.2)" },
            { label: "Open PRs", value: openPRs.length, sub: "1 ready to merge", icon: GitPullRequest, color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)" },
            { label: "Team Online", value: `${online}/${mockTeamMembers.length}`, sub: "1 overloaded", icon: Users, color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.2)" },
            { label: "PRs Merged Today", value: 7, sub: "+2 vs yesterday", icon: GitMerge, color: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.2)" },
          ].map(kpi => (
            <div key={kpi.label} className="glass-card rounded-2xl p-5 transition-card" style={{ borderColor: kpi.border }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: kpi.bg }}>
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <ArrowUpRight className="w-4 h-4 text-gray-600" />
              </div>
              <p className="stat-number text-3xl mb-0.5">{kpi.value}</p>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#606080" }}>{kpi.label}</p>
              <p className="text-xs mt-1" style={{ color: kpi.color }}>{kpi.sub}</p>
            </div>
          ))}
        </div>

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* Left col: tab panel */}
          <div className="lg:col-span-2 space-y-6">

            {/* Tab switcher */}
            <div className="flex items-center gap-1 p-1 rounded-xl w-fit" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
              {(["queue", "prs"] as const).map(tab => (
                <button key={tab} onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>
                  {tab === "queue" ? "🚨 Priority Queue" : "🔀 Open PRs"}
                </button>
              ))}
            </div>

            {activeTab === "queue" && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">Priority Queue</h2>
                    <p className="text-xs mt-0.5" style={{ color: "#606080" }}>Auto-ranked by urgency · AI-summarized</p>
                  </div>
                  <a href="/maintainer/triage" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1">
                    Full Triage <ArrowUpRight className="w-3 h-3" />
                  </a>
                </div>
                <div className="space-y-3">
                  {mockPriorityIssues.map(issue => {
                    const pcfg = priorityConfig[issue.priority];
                    return (
                      <div key={issue.id} className="p-4 rounded-xl transition-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-start justify-between gap-4 flex-wrap">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className={`text-xs px-2 py-0.5 rounded-full font-semibold ${pcfg.cls}`}>{pcfg.label}</span>
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium"
                                style={{ background: categoryColors[issue.category] || "rgba(124,58,237,0.15)", color: categoryTextColors[issue.category] || "#C4B5FD" }}>
                                {issue.category}
                              </span>
                              {issue.duplicateOf && (
                                <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: "rgba(245,158,11,0.15)", color: "#FCD34D" }}>
                                  ⚠ Possible Duplicate
                                </span>
                              )}
                              <span className="text-xs" style={{ color: "#606080" }}>{issue.repo}</span>
                            </div>
                            <h3 className="font-semibold text-white mb-1.5 text-sm leading-snug">{issue.title}</h3>
                            <p className="text-xs leading-relaxed" style={{ color: "#A0A0C0" }}>{issue.aiSummary}</p>
                            <div className="flex items-center gap-4 mt-3 text-xs flex-wrap" style={{ color: "#606080" }}>
                              <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{issue.openedAt}</span>
                              <span className="flex items-center gap-1"><MessageSquare className="w-3 h-3" />{issue.comments}</span>
                              <span>@<span className="font-semibold" style={{ color: "#A78BFA" }}>{issue.contributor.name}</span></span>
                              <span>Trust: <span className="font-semibold" style={{ color: issue.contributor.trustScore >= 80 ? "#10B981" : issue.contributor.trustScore >= 50 ? "#F59E0B" : "#EF4444" }}>{issue.contributor.trustScore}%</span></span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-2 flex-shrink-0">
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold btn-primary"><Users className="w-3 h-3" />Assign</button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-secondary"><Tag className="w-3 h-3" />Label</button>
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-secondary"><ExternalLink className="w-3 h-3" />Open</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeTab === "prs" && (
              <div className="glass-card rounded-2xl p-5">
                <div className="flex items-center justify-between mb-5">
                  <div>
                    <h2 className="font-display text-lg font-bold text-white">Open Pull Requests</h2>
                    <p className="text-xs mt-0.5" style={{ color: "#606080" }}>Awaiting review or merge</p>
                  </div>
                </div>
                <div className="space-y-3">
                  {openPRs.map(pr => {
                    const s = prStatusConfig[pr.status];
                    return (
                      <div key={pr.id} className="p-4 rounded-xl transition-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                        <div className="flex items-start justify-between gap-4">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 mb-2 flex-wrap">
                              <span className="text-xs px-2 py-0.5 rounded-full font-medium" style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>{s.label}</span>
                              <span className="text-xs" style={{ color: "#606080" }}>{pr.repo} #{pr.id}</span>
                            </div>
                            <h3 className="font-semibold text-white text-sm mb-2 leading-snug">{pr.title}</h3>
                            <div className="flex items-center gap-4 text-xs flex-wrap" style={{ color: "#606080" }}>
                              <span>by <span className="text-purple-400 font-medium">@{pr.author}</span></span>
                              <span className="text-green-400">+{pr.additions}</span>
                              <span className="text-red-400">−{pr.deletions}</span>
                              {pr.reviewers.length > 0 && (
                                <span className="flex items-center gap-1">
                                  Reviewers: {pr.reviewers.map(r => (
                                    <span key={r} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold text-white level-badge">{r}</span>
                                  ))}
                                </span>
                              )}
                            </div>
                          </div>
                          <div className="flex gap-2 flex-shrink-0">
                            {pr.status === "approved" && (
                              <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold" style={{ background: "rgba(16,185,129,0.2)", color: "#34D399", border: "1px solid rgba(16,185,129,0.4)" }}><GitMerge className="w-3 h-3" />Merge</button>
                            )}
                            <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium btn-secondary"><ExternalLink className="w-3 h-3" />View</button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Stale issues */}
            <div className="glass-card rounded-2xl p-5">
              <h2 className="font-display text-lg font-bold text-white mb-1">⏰ Stale Issues</h2>
              <p className="text-xs mb-4" style={{ color: "#606080" }}>Untouched for 28+ days · Consider closing or pinging</p>
              <div className="space-y-2">
                {mockStaleIssues.map(issue => (
                  <div key={issue.id} className="flex items-center justify-between gap-4 p-3 rounded-xl" style={{ background: "rgba(255,255,255,0.03)" }}>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{issue.title}</p>
                      <p className="text-xs" style={{ color: "#606080" }}>{issue.repo} · Last activity: {issue.lastActivity}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className={`text-xs px-2 py-0.5 rounded-full ${priorityConfig[issue.priority as keyof typeof priorityConfig].cls}`}>{issue.priority}</span>
                      <button className="text-xs px-3 py-1.5 rounded-lg btn-secondary">Ping</button>
                      <button className="text-xs px-3 py-1.5 rounded-lg text-gray-500 hover:text-white transition-colors">Close</button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right col: team + activity */}
          <div className="space-y-5">
            {/* Repo health mini */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Shield className="w-4 h-4 text-cyan-400" /> Repo Health
              </h3>
              <div className="space-y-3">
                {mockAnalytics.repoHealth.map(repo => {
                  const color = repo.score >= 90 ? "#10B981" : repo.score >= 70 ? "#F59E0B" : "#EF4444";
                  const repoShort = repo.repo.split("/")[1];
                  return (
                    <div key={repo.repo}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="text-white font-medium">{repoShort}</span>
                        <span className="font-bold" style={{ color }}>{repo.score}</span>
                      </div>
                      <div className="xp-bar h-1.5">
                        <div className="h-full rounded-full" style={{ width: `${repo.score}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Team snapshot */}
            <div className="glass-card rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-bold text-white flex items-center gap-2">
                  <Users className="w-4 h-4 text-cyan-400" /> Team
                </h3>
                <a href="/maintainer/team" className="text-xs text-cyan-400 hover:text-cyan-300 transition-colors">View all →</a>
              </div>
              <div className="space-y-3">
                {mockTeamMembers.map(m => (
                  <div key={m.id} className="flex items-center gap-3">
                    <div className="relative flex-shrink-0">
                      <div className="w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold text-white level-badge">{m.avatar}</div>
                      <div className={`absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full border-2 status-${m.status}`} style={{ borderColor: "#060611" }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white truncate">{m.name}</p>
                      <div className="xp-bar h-1 mt-1">
                        <div className="h-full rounded-full" style={{
                          width: `${m.workloadPercent}%`,
                          background: m.workloadPercent > 80 ? "#EF4444" : m.workloadPercent > 50 ? "#F59E0B" : "#10B981"
                        }} />
                      </div>
                    </div>
                    <span className="text-xs font-semibold" style={{ color: m.workloadPercent > 80 ? "#EF4444" : m.workloadPercent > 50 ? "#F59E0B" : "#10B981" }}>
                      {m.workloadPercent}%
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Activity feed */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Activity className="w-4 h-4 text-purple-400" /> Live Activity
              </h3>
              <div className="space-y-3">
                {activityFeed.map((e, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5" style={{ background: `${e.color}20` }}>
                      <e.icon className="w-3.5 h-3.5" style={{ color: e.color }} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs text-white leading-snug">
                        <span className="font-semibold" style={{ color: "#A78BFA" }}>{e.user}</span>
                        {" "}{e.action}
                      </p>
                      <p className="text-[10px] mt-0.5" style={{ color: "#606080" }}>{e.repo} · {e.time}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Today's stats */}
            <div className="glass-card rounded-2xl p-5">
              <h3 className="font-display font-bold text-white mb-4 flex items-center gap-2">
                <Zap className="w-4 h-4 text-amber-400" /> Today's Stats
              </h3>
              <div className="space-y-2">
                {[
                  { label: "New Issues", value: "14", color: "text-white" },
                  { label: "PRs Merged", value: "7", color: "text-green-400" },
                  { label: "Issues Closed", value: "11", color: "text-cyan-400" },
                  { label: "Active Contributors", value: "23", color: "text-purple-400" },
                  { label: "Avg Response Time", value: "2.8h", color: "text-amber-400" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center text-sm" style={{ color: "#A0A0C0" }}>
                    <span>{s.label}</span>
                    <span className={`font-bold ${s.color}`}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
