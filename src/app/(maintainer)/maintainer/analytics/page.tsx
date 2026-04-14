"use client";
import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { account } from "@/lib/appwrite";
import { getAnalyticsData } from "../actions";
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

export default function AnalyticsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timeFilter, setTimeFilter] = useState<"7d" | "30d" | "90d">("30d");

  useEffect(() => {
    const init = async () => {
      try {
        const session = await account.get();
        let handle = session.name.replace(/\s+/g, '-').toLowerCase();
        let token = "";
        
        const identities = await account.listIdentities();
        const gh = identities.identities.find(id => id.provider.toLowerCase() === 'github');
        if (gh) {
          token = (gh as any).providerAccessToken;
          if (session.name.toLowerCase().includes("ayush patel")) {
            handle = "Ayush-Patel-56";
          }
        }

        const res = await getAnalyticsData(handle, token);
        if (res.success) {
          setData(res);
        }
      } catch (e) {
        console.error("Analytics init failed", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#060611]">
      <div className="w-12 h-12 border-4 border-purple-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data || data.empty) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060611] text-white p-6 text-center text-zinc-500 font-bold uppercase tracking-widest">
      No analytics data available
    </div>
  );

  const summaryKpis = [
    { label: "Avg Merge Velocity", value: data.summary.mergeVelocity, delta: "-2.1h", positive: true, icon: GitMerge, color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)" },
    { label: "Issue Closure Rate", value: data.summary.closureRate, delta: "+5%", positive: true, icon: TrendingUp, color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.2)" },
    { label: "Contributor Retention", value: data.summary.retention, delta: "+8%", positive: true, icon: Users, color: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.2)" },
    { label: "Open Issue Backlog", value: data.summary.backlog, delta: "+23", positive: false, icon: AlertTriangle, color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.2)" },
  ];

  const barChartData = [
    { month: "Oct", new: 38, returning: 22 },
    { month: "Nov", new: 45, returning: 31 },
    { month: "Dec", new: 28, returning: 25 },
    { month: "Jan", new: 52, returning: 36 },
    { month: "Feb", new: 68, returning: 48 },
    { month: "Mar", new: 74, returning: 55 },
  ];

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Analytics" subtitle="Repository health and contribution metrics" />

      <div className="p-12 max-w-7xl space-y-8 mx-auto">

        {/* Time filter + KPI row */}
        <div className="flex items-center justify-between gap-4 flex-wrap mb-4">
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
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
          {summaryKpis.map(kpi => (
            <div key={kpi.label} className="glass-card rounded-2xl p-6 transition-card bg-white/5 border border-white/5" style={{ borderColor: kpi.border }}>
              <div className="flex items-start justify-between mb-4">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg" style={{ background: kpi.bg }}>
                  <kpi.icon className="w-5 h-5" style={{ color: kpi.color }} />
                </div>
                <span className={`text-[10px] font-black uppercase tracking-widest flex items-center gap-1 ${kpi.positive ? "text-emerald-400" : "text-rose-400"}`}>
                  {kpi.positive ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                  {kpi.delta}
                </span>
              </div>
              <p className="stat-number text-3xl font-black mb-1 text-white">{kpi.value}</p>
              <p className="text-[10px] uppercase tracking-[0.2em] font-black text-[#606080]">{kpi.label}</p>
            </div>
          ))}
        </div>

        {/* Charts row 1 */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Issue trend — area chart */}
          <div className="glass-card rounded-2xl p-8 bg-white/5 border border-white/5 shadow-xl">
            <h2 className="font-display font-black text-white mb-1 uppercase tracking-tighter text-lg">Issue Open / Close Trend</h2>
            <p className="text-[10px] mb-8 font-black uppercase tracking-widest text-[#606080]">Daily opened vs closed issues · {timeFilter}</p>
            <ResponsiveContainer width="100%" height={260}>
              <AreaChart data={data.trends.issueTrend}>
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
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "2px", opacity: 0.8 }} />
                <Area type="monotone" dataKey="opened" stroke="#EF4444" fill="url(#gradOpened)" strokeWidth={3} name="Opened" />
                <Area type="monotone" dataKey="closed" stroke="#10B981" fill="url(#gradClosed)" strokeWidth={3} name="Closed" />
              </AreaChart>
            </ResponsiveContainer>
          </div>

          {/* PR Merge Velocity */}
          <div className="glass-card rounded-2xl p-8 bg-white/5 border border-white/5 shadow-xl">
            <h2 className="font-display font-black text-white mb-1 uppercase tracking-tighter text-lg">PR Merge Velocity</h2>
            <p className="text-[10px] mb-8 font-black uppercase tracking-widest text-[#606080]">Average hours from PR open to merge · {timeFilter}</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={data.trends.velocityTrend}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
                <XAxis dataKey="date" tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={chartTooltipStyle} />
                <Line type="monotone" dataKey="avgHours" stroke="#7C3AED" strokeWidth={4}
                  dot={{ fill: "#A78BFA", r: 6, strokeWidth: 0 }} activeDot={{ r: 8, strokeWidth: 0 }} name="Avg Hours" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Contributor Retention */}
        <div className="glass-card rounded-2xl p-8 bg-white/5 border border-white/5 shadow-xl">
          <h2 className="font-display font-black text-white mb-1 uppercase tracking-tighter text-lg">Contributor Retention</h2>
          <p className="text-[10px] mb-8 font-black uppercase tracking-widest text-[#606080]">New vs returning contributors per month</p>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={barChartData} barGap={8}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)" vertical={false} />
              <XAxis dataKey="month" tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fill: "#606080", fontSize: 10, fontWeight: 800 }} axisLine={false} tickLine={false} />
              <Tooltip contentStyle={chartTooltipStyle} />
              <Legend wrapperStyle={{ fontSize: "10px", fontWeight: "900", textTransform: "uppercase", letterSpacing: "2px", opacity: 0.8 }} />
              <Bar dataKey="new" fill="#7C3AED" name="New" radius={[6, 6, 0, 0]} />
              <Bar dataKey="returning" fill="#06B6D4" name="Returning" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Repo Health */}
        <div className="glass-card rounded-2xl p-8 bg-white/5 border border-white/5 shadow-xl">
          <h2 className="font-display font-black text-white mb-1 uppercase tracking-tighter text-lg">Repository Health Scores</h2>
          <p className="text-[10px] mb-10 font-black uppercase tracking-widest text-[#606080]">Combined score of activity, response time, and backlog</p>
          <div className="space-y-6">
            {data.repoHealth.map((repo: any) => {
              const color = repo.score >= 90 ? "#10B981" : repo.score >= 70 ? "#F59E0B" : "#EF4444";
              const label = repo.score >= 90 ? "Healthy" : repo.score >= 70 ? "Moderate" : "At Risk";
              return (
                <div key={repo.repo} className="flex items-center gap-6 p-5 rounded-2xl transition-all hover:bg-white/[0.04] border border-white/[0.03]">
                  <HealthGauge score={repo.score} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 mb-1.5">
                      <p className="text-sm font-black text-white uppercase tracking-tight">{repo.repo}</p>
                      <span className="text-[9px] px-2 py-0.5 rounded-full font-black uppercase tracking-widest" style={{ background: `${color}20`, color, border: `1px solid ${color}30` }}>{label}</span>
                    </div>
                    <p className="text-[10px] font-bold text-[#606080] uppercase tracking-widest">{repo.issues} open issues · {repo.prs} open PRs</p>
                    <div className="xp-bar h-2 mt-3 bg-white/5 rounded-full overflow-hidden">
                      <div className="h-full rounded-full transition-all duration-1000 ease-out" style={{ width: `${repo.score}%`, background: `linear-gradient(90deg, ${color}, ${color}99)` }} />
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className="font-display font-black text-2xl" style={{ color }}>{repo.score}</span>
                    <p className="text-[10px] font-black text-[#606080] uppercase tracking-widest">/ 100</p>
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
