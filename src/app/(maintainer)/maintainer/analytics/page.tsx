"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { mockAnalytics } from "@/data/maintainers";
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend, ResponsiveContainer, AreaChart, Area
} from "recharts";
import { TrendingUp, TrendingDown, GitMerge, Users, AlertTriangle, Clock } from "lucide-react";

const timeFilters = ["7d", "30d", "90d"] as const;

const chartTooltipStyle = {
  backgroundColor: "#12122B",
  border: "1px solid rgba(255,255,255,0.1)",
  borderRadius: "8px",
  color: "#F8F8FF",
  fontSize: "12px",
};

function HealthGauge({ score }: { score: number }) {
  const color = score >= 90 ? "#10B981" : score >= 70 ? "#F59E0B" : "#EF4444";
  const circumference = 94;
  return (
    <div className="relative w-12 h-12 flex-shrink-0">
      <svg className="w-12 h-12 -rotate-90" viewBox="0 0 36 36">
        <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="4" />
        <circle cx="18" cy="18" r="15" fill="none" stroke={color} strokeWidth="4"
          strokeDasharray={`${(score / 100) * circumference} ${circumference}`} strokeLinecap="round" />
      </svg>
      <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold" style={{ color }}>{score}</span>
    </div>
  );
}

const summaryKpis = [
  { label: "Avg Merge Velocity", value: "12.4h", delta: "-2.1h", positive: true, icon: GitMerge, color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)" },
  { label: "Issue Closure Rate", value: "78%", delta: "+5%", positive: true, icon: TrendingUp, color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.2)" },
  { label: "Contributor Retention", value: "74%", delta: "+8%", positive: true, icon: Users, color: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.2)" },
  { label: "Open Issue Backlog", value: "499", delta: "+23", positive: false, icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.2)" },
];

export default function AnalyticsPage() {
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "90d">("30d");

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Analytics" subtitle="Repository health and contribution metrics" />

      <div className="p-6 max-w-7xl space-y-6">

        {/* Time filter + KPI row */}
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
            {timeFilters.map(f => (
              <button key={f} onClick={() => setTimeFilter(f)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${timeFilter === f ? "bg-purple-600 text-white" : "text-gray-400 hover:text-white"}`}>
                {f}
              </button>
            ))}
          </div>
        </div>

        {/* KPI summary cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {summaryKpis.map(kpi => (
            <div key={kpi.label} className="glass-card rounded-2xl p-4 transition-card" style={{ borderColor: kpi.border }}>
              <div className="flex items-start justify-between mb-3">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: kpi.bg }}>
                  <kpi.icon className="w-4 h-4" style={{ color: kpi.color }} />
                </div>
                <span className={`text-xs font-semibold flex items-center gap-0.5 ${kpi.positive ? "text-green-400" : "text-red-400"}`}>
                  {kpi.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {kpi.delta}
                </span>
              </div>
              <p className="stat-number text-2xl mb-0.5">{kpi.value}</p>
              <p className="text-xs uppercase tracking-widest font-semibold" style={{ color: "#606080" }}>{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Issue trend — area chart */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-bold text-white mb-0.5">Issue Open / Close Trend</h2>
            <p className="text-xs mb-5" style={{ color: "#606080" }}>Daily opened vs closed issues · {timeFilter}</p>
            <ResponsiveContainer width="100%" height={220}>
              <AreaChart data={mockAnalytics.issueOpenClose}>
                <defs>
                  <linearGradient id="gradOpened" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#EF4444" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#EF4444" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gradClosed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10B981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10B981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "12px", color: "#A0A0C0" }} />
                <Area type="monotone" dataKey="opened" stroke="#EF4444" fill="url(#gradOpened)" strokeWidth={2} name="Opened" />
                <Area type="monotone" dataKey="closed" stroke="#10B981" fill="url(#gradClosed)" strokeWidth={2} name="Closed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PR Merge Velocity */}
          <div className="glass-card rounded-2xl p-5">
            <h2 className="font-display font-bold text-white mb-0.5">PR Merge Velocity</h2>
            <p className="text-xs mb-5" style={{ color: "#606080" }}>Average hours from PR open to merge · {timeFilter}</p>
            <ResponsiveContainer width="100%" height={220}>
              <LineChart data={mockAnalytics.prMergeVelocity}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="date" tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="avgHours" stroke="#7C3AED" strokeWidth={2}
                  dot={{ fill: "#A78BFA", r: 4, strokeWidth: 0 }} name="Avg Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contributor Retention */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-white mb-0.5">Contributor Retention</h2>
          <p className="text-xs mb-5" style={{ color: "#606080" }}>New vs returning contributors per month</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={mockAnalytics.contributorRetention} barGap={4}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="month" tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#606080", fontSize: 11 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "12px", color: "#A0A0C0" }} />
              <Bar dataKey="new" fill="#7C3AED" name="New" radius={[4, 4, 0, 0]} />
              <Bar dataKey="returning" fill="#06B6D4" name="Returning" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Repo Health */}
        <div className="glass-card rounded-2xl p-5">
          <h2 className="font-display font-bold text-white mb-1">Repository Health Scores</h2>
          <p className="text-xs mb-5" style={{ color: "#606080" }}>Combined score of activity, response time, and backlog</p>
          <div className="space-y-3">
            {mockAnalytics.repoHealth.map(repo => {
              const color = repo.score >= 90 ? "#10B981" : repo.score >= 70 ? "#F59E0B" : "#EF4444";
              const label = repo.score >= 90 ? "Healthy" : repo.score >= 70 ? "Moderate" : "At Risk";
              return (
                <div key={repo.repo} className="flex items-center gap-4 p-3 rounded-xl transition-card" style={{ background: "rgba(255,255,255,0.03)" }}>
                  <HealthGauge score={repo.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <p className="text-sm font-semibold text-white">{repo.repo}</p>
                      <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold" style={{ background: `${color}20`, color }}>{label}</span>
                    </div>
                    <p className="text-xs" style={{ color: "#606080" }}>{repo.issues} open issues · {repo.prs} open PRs</p>
                    <div className="xp-bar h-1.5 mt-2">
                      <div className="h-full rounded-full transition-all" style={{ width: `${repo.score}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-display font-bold text-lg" style={{ color }}>{repo.score}</span>
                    <p className="text-[10px]" style={{ color: "#606080" }}>/ 100</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
