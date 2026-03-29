"use client";
import { GitMerge, ExternalLink } from "lucide-react";
import { motion } from "framer-motion";

interface OpenPRsProps {
  prs: any[];
}

const prStatusConfig: Record<string, any> = {
  approved: { label: "Approved", color: "#10B981", bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)" },
  changes_requested: { label: "Changes Requested", color: "#F59E0B", bg: "rgba(245,158,11,0.12)", border: "rgba(245,158,11,0.3)" },
  pending: { label: "Awaiting Review", color: "#606080", bg: "rgba(255,255,255,0.05)", border: "rgba(255,255,255,0.1)" },
};

export function OpenPRs({ prs }: OpenPRsProps) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-black text-white uppercase tracking-tighter">Open Pull Requests</h2>
          <p className="text-[10px] mt-1 font-bold text-[#606080] uppercase tracking-widest">Awaiting review or merge</p>
        </div>
      </div>
      <div className="space-y-4">
        {prs.map((pr) => {
          const s = prStatusConfig[pr.status as keyof typeof prStatusConfig] || prStatusConfig.pending;
          return (
            <motion.div
              key={pr.id}
              whileHover={{ x: 4 }}
              className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all font-sans"
            >
              <div className="flex items-start justify-between gap-6">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border"
                      style={{ background: s.bg, color: s.color, borderColor: s.border }}>
                      {s.label}
                    </span>
                    <span className="text-[10px] font-bold text-[#606080] uppercase tracking-widest opacity-80">{pr.repo} #{pr.id}</span>
                  </div>
                  <h3 className="font-bold text-white text-base mb-2 leading-snug">{pr.title}</h3>
                  <div className="flex items-center gap-6 text-[10px] font-black uppercase tracking-widest text-[#606080]">
                    <span>by <span className="text-[#A78BFA]">@{pr.author}</span></span>
                    <span className="text-[#4ADE80]">+{pr.additions}</span>
                    <span className="text-[#EF4444]">−{pr.deletions}</span>
                    {pr.reviewers && pr.reviewers.length > 0 && (
                      <span className="flex items-center gap-2">
                        Reviewers: {pr.reviewers.map((r: string) => (
                          <span key={r} className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-white bg-white/5 border border-white/10 uppercase tracking-tighter shadow-md">
                            {r}
                          </span>
                        ))}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex gap-2 flex-shrink-0">
                  {pr.status === "approved" && (
                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-transform hover:scale-105 shadow-lg shadow-[#10B981]/10"
                      style={{ background: "rgba(16,185,129,0.2)", color: "#34D399", border: "1px solid rgba(16,185,129,0.4)" }}>
                      <GitMerge className="w-3.5 h-3.5" />Merge
                    </button>
                  )}
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white hover:bg-white/10 transition-transform hover:scale-105">
                    <ExternalLink className="w-3.5 h-3.5" />View
                  </button>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
