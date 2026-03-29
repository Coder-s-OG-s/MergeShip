"use client";
import { AlertTriangle, GitPullRequest, Users, GitMerge, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

interface KpiItemProps {
  label: string;
  value: string | number;
  sub: string;
  icon: any;
  color: string;
  bg: string;
  border: string;
}

function KpiItem({ label, value, sub, icon: Icon, color, bg, border }: KpiItemProps) {
  return (
    <motion.div
      whileHover={{ y: -4, borderColor: color }}
      className="glass-card rounded-2xl p-5 transition-all bg-[#1E1826]/40 backdrop-blur-sm border"
      style={{ borderColor: border }}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: bg }}>
          <Icon className="w-5 h-5" style={{ color }} />
        </div>
        <ArrowUpRight className="w-4 h-4 text-gray-600" />
      </div>
      <p className="text-3xl font-bold text-white mb-0.5">{value}</p>
      <p className="text-[10px] uppercase tracking-widest font-black text-[#606080]">{label}</p>
      <p className="text-[10px] mt-1 font-bold" style={{ color }}>{sub}</p>
    </motion.div>
  );
}

export function KpiBanner({ online, urgent, openPRsCount }: { online: string; urgent: number; openPRsCount: number }) {
  const kpis = [
    { label: "Urgent Issues", value: urgent, sub: "Critical + High", icon: AlertTriangle, color: "#EF4444", bg: "rgba(239,68,68,0.12)", border: "rgba(239,68,68,0.2)" },
    { label: "Open PRs", value: openPRsCount, sub: "1 ready to merge", icon: GitPullRequest, color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.2)" },
    { label: "Team Online", value: online, sub: "1 overloaded", icon: Users, color: "#06B6D4", bg: "rgba(6,182,212,0.12)", border: "rgba(6,182,212,0.2)" },
    { label: "PRs Merged Today", value: 7, sub: "+2 vs yesterday", icon: GitMerge, color: "#A78BFA", bg: "rgba(124,58,237,0.12)", border: "rgba(124,58,237,0.2)" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {kpis.map((kpi) => (
        <KpiItem key={kpi.label} {...kpi} />
      ))}
    </div>
  );
}
