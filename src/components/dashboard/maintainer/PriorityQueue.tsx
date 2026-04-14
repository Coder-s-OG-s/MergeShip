"use client";
import { Clock, MessageSquare, Users, Tag, ExternalLink, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";

const priorityConfig = {
  critical: { label: "Critical", cls: "bg-red-500/20 text-red-500 border-red-500/20" },
  high: { label: "High", cls: "bg-orange-500/20 text-orange-500 border-orange-500/20" },
  medium: { label: "Medium", cls: "bg-yellow-500/20 text-yellow-500 border-yellow-500/20" },
  low: { label: "Low", cls: "bg-green-500/20 text-green-500 border-green-500/20" },
};

const categoryColors: Record<string, string> = {
  Bug: "#FCA5A5", Feature: "#67E8F9", Duplicate: "#FCD34D",
  Question: "#C4B5FD", Docs: "#6EE7B7",
};

export function PriorityQueue({ issues }: { issues: any[] }) {
  return (
    <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h2 className="font-display text-xl font-black text-white uppercase tracking-tighter">Priority Queue</h2>
          <p className="text-[10px] mt-1 font-bold text-[#606080] uppercase tracking-widest">Auto-ranked by urgency · AI-summarized</p>
        </div>
        <a href="/maintainer/triage" className="text-[10px] font-black text-cyan-400 hover:text-cyan-300 transition-colors flex items-center gap-1.5 uppercase tracking-widest">
          Full Triage <ArrowUpRight className="w-4 h-4" />
        </a>
      </div>
      <div className="space-y-4">
        {issues.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-[10px] font-black uppercase tracking-widest text-[#606080]">No urgent issues found for this repository</p>
          </div>
        ) : issues.map((issue) => {
          const pcfg = priorityConfig[issue.priority as keyof typeof priorityConfig];
          return (
            <motion.div
              key={issue.id}
              whileHover={{ x: 4 }}
              className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all"
            >
              <div className="flex items-start justify-between gap-6 flex-wrap">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-3 flex-wrap">
                    <span className={`text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border ${pcfg.cls}`}>{pcfg.label}</span>
                    <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest bg-white/5"
                      style={{ color: categoryColors[issue.category] || "#C4B5FD" }}>
                      {issue.category}
                    </span>
                    {issue.duplicateOf && (
                      <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest bg-orange-500/10 text-orange-400 border border-orange-500/10">
                        ⚠ Duplicate
                      </span>
                    )}
                    <span className="text-[10px] font-bold text-[#606080] uppercase tracking-widest">{issue.repo}</span>
                  </div>
                  <h3 className="font-bold text-white mb-2 text-base leading-snug">{issue.title}</h3>
                  <p className="text-xs leading-relaxed text-[#A0A0C0] mb-4 font-medium opacity-80">{issue.aiSummary}</p>
                  <div className="flex items-center gap-6 mt-3 text-[10px] font-bold text-[#606080] uppercase tracking-widest flex-wrap">
                    <span className="flex items-center gap-1.5"><Clock className="w-3.5 h-3.5" />{issue.openedAt}</span>
                    <span className="flex items-center gap-1.5"><MessageSquare className="w-3.5 h-3.5" />{issue.comments}</span>
                    <span>@<span className="text-[#A78BFA]">{issue.contributor.name}</span></span>
                    <span>Trust: <span style={{ color: issue.contributor.trustScore >= 80 ? "#10B981" : issue.contributor.trustScore >= 50 ? "#F59E0B" : "#EF4444" }}>{issue.contributor.trustScore}%</span></span>
                  </div>
                </div>
                <div className="flex flex-col gap-2 flex-shrink-0">
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-[#06B6D4] text-[#110E15] transition-transform hover:scale-105 shadow-lg shadow-[#06B6D4]/10"><Users className="w-3.5 h-3.5" />Assign</button>
                  <button className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white hover:bg-white/10 transition-transform hover:scale-105"><Tag className="w-3.5 h-3.5" />Label</button>
                  <a 
                    href={issue.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white hover:bg-white/10 transition-transform hover:scale-105"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />Open
                  </a>
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
