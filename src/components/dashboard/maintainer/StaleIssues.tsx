"use client";
import { Clock, Zap } from "lucide-react";
import { motion } from "framer-motion";

const priorityConfig = {
  critical: "bg-red-500/20 text-red-500 border-red-500/20",
  high: "bg-orange-500/20 text-orange-500 border-orange-500/20",
  medium: "bg-yellow-500/20 text-yellow-500 border-yellow-500/20",
  low: "bg-green-500/20 text-green-500 border-green-500/20",
};

export function StaleIssues({ issues }: { issues: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <h2 className="font-display text-xl font-black text-white hover:text-amber-400 transition-colors uppercase tracking-widest text-[10px] mb-2 flex items-center gap-2">
        <Clock className="w-5 h-5 text-amber-400" /> ⏰ Stale Issues
      </h2>
      <p className="text-[10px] mb-8 font-black text-[#606080] uppercase tracking-widest opacity-80">Untouched for 28+ days · Consider closing or pinging</p>
      <div className="space-y-3">
        {issues.map((issue) => (
          <motion.div
            key={issue.id}
            whileHover={{ y: -2 }}
            className="flex items-center justify-between gap-6 p-4 rounded-2xl bg-white/5 border border-white/5 hover:bg-white/10 transition-all font-sans"
          >
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-white truncate mb-1 group-hover:underline underline-offset-4">{issue.title}</p>
              <p className="text-[10px] font-black uppercase tracking-widest text-[#606080]">{issue.repo} · <span className="opacity-70 font-bold">Last activity: {issue.lastActivity}</span></p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span className={`text-[8px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border ${priorityConfig[issue.priority as keyof typeof priorityConfig]}`}>{issue.priority}</span>
              <button className="text-[10px] px-3.5 py-1.5 rounded-xl font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 text-[#110E15] transition-all">Ping</button>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function TodayStats({ stats }: { stats: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <h3 className="font-display font-black text-white uppercase tracking-widest text-[10px] mb-8 flex items-center gap-2">
        <Zap className="w-5 h-5 text-amber-400 shadow-lg shadow-amber-400/20" /> Today's Stats
      </h3>
      <div className="space-y-3.5">
        {stats.map((s) => (
          <div key={s.label} className="flex justify-between items-center text-[10px] font-black uppercase tracking-widest text-[#606080] hover:text-white transition-colors group">
            <span className="group-hover:translate-x-1 transition-transform">{s.label}</span>
            <span className={`font-black tracking-widest transition-transform group-hover:scale-110 ${s.textColor || 'text-white'}`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
