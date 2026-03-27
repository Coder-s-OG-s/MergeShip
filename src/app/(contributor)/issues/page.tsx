"use client";

import { useState } from "react";
import { mockIssues } from "@/data/issues";
import { Star, Clock, Bookmark, BookmarkCheck, ExternalLink, Zap, Filter, GitCommit, MessageSquare, ShieldCheck } from "lucide-react";

const difficultyConfig = {
  easy: { label: "EASY", color: "#4ADE80", bg: "rgba(74,222,128,0.1)", dot: "#4ADE80", tier: "EASY PICKINGS" },
  medium: { label: "MEDIUM", color: "#FACC15", bg: "rgba(250,204,21,0.1)", dot: "#FACC15", tier: "STANDARD QUESTS" },
  hard: { label: "HARD", color: "#EF4444", bg: "rgba(239,68,68,0.1)", dot: "#EF4444", tier: "ELITE CHALLENGES" },
};

export default function IssuesPage() {
  const [filter, setFilter] = useState<"all" | "easy" | "medium" | "hard">("all");
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    new Set(mockIssues.filter(i => i.isBookmarked).map(i => i.id))
  );

  const visible = filter === "all" ? mockIssues : mockIssues.filter(i => i.difficulty === filter);

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const easy = visible.filter(i => i.difficulty === "easy");
  const medium = visible.filter(i => i.difficulty === "medium");
  const hard = visible.filter(i => i.difficulty === "hard");

  return (
    <div className="max-w-[1400px] mx-auto p-8 font-sans">
      
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-display font-bold text-white mb-2">Explore Credible Issues</h1>
        <p className="text-[#8B7E9F] text-sm">Your personalized feed is strictly filtered to repositories within your active GitHub network.</p>
      </div>

      {/* Network Explanation Banner */}
      <div className="rounded-2xl p-6 border border-white/5 bg-[#1E1826] mb-8 flex flex-col md:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <ShieldCheck className="w-5 h-5 text-[#D8B4FE]" />
          <div>
            <h3 className="text-sm font-bold text-white">Trust Filter Active</h3>
            <p className="text-xs text-[#8B7E9F]">We do not suggest random repositories. Showing issues only from:</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-blue-500/10 border border-blue-500/20">
            <Star className="w-4 h-4 text-blue-400" />
            <span className="text-xs font-bold text-blue-400">Starred by You</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <GitCommit className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Past Contributions</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-purple-500/10 border border-purple-500/20">
            <MessageSquare className="w-4 h-4 text-purple-400" />
            <span className="text-xs font-bold text-purple-400">Active Discussions</span>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {/* Filter bar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#1E1826", border: "1px solid rgba(255,255,255,0.05)" }}>
            {(["all", "easy", "medium", "hard"] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filter === f ? "bg-[#D8B4FE] text-[#15111A]" : "text-[#8B7E9F] hover:text-white"}`}
              >
                {f === "all" ? "All Issues" : `${difficultyConfig[f].label}`}
              </button>
            ))}
          </div>
          <div className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#1E1826", border: "1px solid rgba(255,255,255,0.05)", color: "#D8B4FE" }}>
            <Filter className="w-4 h-4" />
            <span>{visible.length} issues shown</span>
          </div>
        </div>

        {/* Tier sections */}
        {[
          { items: easy, diff: "easy" as const },
          { items: medium, diff: "medium" as const },
          { items: hard, diff: "hard" as const },
        ].map(section => section.items.length > 0 && (
          <div key={section.diff}>
            <div className="mb-4 flex items-center gap-2 px-1">
              <div className="w-2.5 h-2.5 rounded-full" style={{ background: difficultyConfig[section.diff].dot }} />
              <h2 className="text-sm font-bold tracking-widest text-white">{difficultyConfig[section.diff].tier}</h2>
              <span className="text-xs px-2 py-0.5 rounded ml-2 font-bold" style={{ background: "rgba(255,255,255,0.05)", color: "#8B7E9F" }}>
                {section.items.length} matched
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {section.items.map(issue => {
                const cfg = difficultyConfig[issue.difficulty];
                const isBookmarked = bookmarks.has(issue.id);
                
                // Determine icon and color based on network reason type
                let NetworkIcon = Star;
                let networkColor = "text-blue-400";
                let networkBg = "bg-blue-500/10";
                let networkBorder = "border-blue-500/20";

                if (issue.networkReason?.type === "contribute") {
                  NetworkIcon = GitCommit;
                  networkColor = "text-emerald-400";
                  networkBg = "bg-emerald-500/10";
                  networkBorder = "border-emerald-500/20";
                } else if (issue.networkReason?.type === "comment") {
                  NetworkIcon = MessageSquare;
                  networkColor = "text-purple-400";
                  networkBg = "bg-purple-500/10";
                  networkBorder = "border-purple-500/20";
                }

                return (
                  <div key={issue.id} className="rounded-2xl p-5 border border-white/5 hover:border-[#D8B4FE]/30 transition-colors cursor-pointer flex flex-col gap-4" style={{ background: "#1E1826" }}>
                    
                    {/* Header */}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 text-[#8B7E9F] text-xs font-medium">
                          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 text-white">
                            <span className="text-[10px]">{issue.repo.charAt(0).toUpperCase()}</span>
                          </div>
                          <span>{issue.repo}</span>
                        </div>
                        <h3 className="font-bold text-white text-base leading-snug mb-3">{issue.title}</h3>
                        
                        {/* Network Credibility Badge */}
                        {issue.networkReason && (
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded w-fit border ${networkBg} ${networkBorder} mb-3`}>
                            <NetworkIcon className={`w-3 h-3 ${networkColor}`} />
                            <span className={`text-[10px] font-bold ${networkColor} font-sans tracking-wide`}>
                              {issue.networkReason.text}
                            </span>
                          </div>
                        )}
                        
                        <div className="flex flex-wrap gap-2">
                          <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                          {issue.skills.slice(0, 2).map(l => (
                            <span key={l} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">{l}</span>
                          ))}
                        </div>
                      </div>
                      <button onClick={() => toggleBookmark(issue.id)} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                        {isBookmarked
                          ? <BookmarkCheck className="w-4 h-4" style={{ color: "#D8B4FE" }} />
                          : <Bookmark className="w-4 h-4 text-[#8B7E9F]" />
                        }
                      </button>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
                      <span className="text-[#8B7E9F] flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="w-3.5 h-3.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                        {issue.estimatedTime}
                      </span>
                      <span className="text-[#D8B4FE] flex items-center gap-1.5">
                        <svg viewBox="0 0 24 24" fill="currentColor" className="w-3.5 h-3.5"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>
                        +{issue.xpReward} XP
                      </span>
                    </div>

                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
