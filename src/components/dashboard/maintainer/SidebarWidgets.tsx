"use client";
import { Shield, Clock, Users, Activity, Zap } from "lucide-react";
import { motion } from "framer-motion";

const priorityConfig = {
  critical: "bg-red-500/20 text-red-500",
  high: "bg-orange-500/20 text-orange-500",
  medium: "bg-yellow-500/20 text-yellow-500",
  low: "bg-green-500/20 text-green-500",
};

export function RepoHealthMini({ health }: { health: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <h3 className="font-display font-black text-white hover:text-cyan-400 transition-colors uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
        <Shield className="w-5 h-5 text-cyan-400 shadow-lg shadow-cyan-400/20" /> Repo Health
      </h3>
      <div className="space-y-4">
        {health.map((repo) => {
          const color = repo.score >= 90 ? "#10B981" : repo.score >= 70 ? "#FACC15" : "#EF4444";
          const repoShort = repo.repo.split("/")[1];
          return (
            <div key={repo.repo} className="group">
              <div className="flex justify-between text-[10px] font-black uppercase tracking-widest mb-1.5 transition-colors group-hover:text-white">
                <span className="text-[#606080] group-hover:text-white/80 transition-colors">{repoShort}</span>
                <span style={{ color }}>{repo.score}</span>
              </div>
              <div className="h-1.5 rounded-full bg-white/5 relative overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${repo.score}%` }}
                  transition={{ duration: 1.2, ease: "easeOut" }}
                  className="h-full rounded-full shadow-lg"
                  style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TeamSnapshot({ members }: { members: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <div className="flex items-center justify-between mb-6">
        <h3 className="font-display font-black text-white uppercase tracking-widest text-[10px] flex items-center gap-2">
          <Users className="w-5 h-5 text-cyan-400 shadow-lg shadow-cyan-400/20" /> Team Pulse
        </h3>
        <a href="/maintainer/team" className="text-[8px] font-black text-cyan-400 hover:text-cyan-300 transition-colors uppercase tracking-[0.2em]">View all →</a>
      </div>
      <div className="space-y-4">
        {members.map((m) => (
          <div key={m.id} className="flex items-center gap-4 group">
            <div className="relative flex-shrink-0 transition-transform group-hover:scale-110">
              <div className="w-10 h-10 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-white/5 border border-white/10 uppercase tracking-tighter shadow-md shadow-black/40">
                {m.avatar}
              </div>
              <div className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-[#060611] bg-${m.status === 'online' ? 'emerald-400' : 'gray-600'}`} />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-bold text-white truncate group-hover:text-cyan-400 transition-colors uppercase tracking-widest">{m.name}</p>
              <div className="h-1 mb-1 mt-2.5 rounded-full bg-white/5">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${m.workloadPercent}%` }}
                  className="h-full rounded-full"
                  style={{
                    background: m.workloadPercent > 80 ? "#EF4444" : m.workloadPercent > 50 ? "#FACC15" : "#10B981"
                  }}
                />
              </div>
            </div>
            <span className="text-[10px] font-black uppercase tracking-widest min-w-[3ch] text-right" style={{ color: m.workloadPercent > 80 ? "#EF4444" : m.workloadPercent > 50 ? "#FACC15" : "#10B981" }}>
              {m.workloadPercent}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ActivityFeed({ feed }: { feed: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <h3 className="font-display font-black text-white uppercase tracking-widest text-[10px] mb-6 flex items-center gap-2">
        <Activity className="w-5 h-5 text-purple-400 shadow-lg shadow-purple-400/20" /> Live Activity
      </h3>
      <div className="space-y-5">
        {feed.map((e, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className="flex items-start gap-4 group cursor-pointer hover:translate-x-1 transition-transform"
          >
            <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5 transition-transform group-hover:scale-110 shadow-lg" style={{ background: `${e.color}15`, border: `1px solid ${e.color}30` }}>
              <e.icon className="w-4 h-4" style={{ color: e.color }} />
            </div>
            <div className="flex-1 min-w-0 uppercase tracking-widest">
              <p className="text-[10px] text-white/90 leading-relaxed font-bold">
                <span className="text-[#A78BFA] group-hover:underline underline-offset-4">{e.user}</span>
                <span className="opacity-70 font-medium"> {e.action}</span>
              </p>
              <p className="text-[8px] mt-1 font-black text-[#606080] opacity-80">{e.repo} · <span className="text-white/60">{e.time}</span></p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
