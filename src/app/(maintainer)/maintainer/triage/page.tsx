"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { mockPriorityIssues, mockStaleIssues } from "@/data/maintainers";
import { Copy, AlertOctagon, RefreshCcw, Search, SlidersHorizontal, ChevronDown } from "lucide-react";

const categories = ["Bug", "Feature", "Duplicate", "Question", "Docs"] as const;
const categoryStyles: Record<string, { bg: string; color: string; border: string }> = {
  Bug: { bg: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "rgba(239,68,68,0.3)" },
  Feature: { bg: "rgba(6,182,212,0.12)", color: "#67E8F9", border: "rgba(6,182,212,0.3)" },
  Duplicate: { bg: "rgba(245,158,11,0.12)", color: "#FCD34D", border: "rgba(245,158,11,0.3)" },
  Question: { bg: "rgba(124,58,237,0.12)", color: "#C4B5FD", border: "rgba(124,58,237,0.3)" },
  Docs: { bg: "rgba(16,185,129,0.12)", color: "#6EE7B7", border: "rgba(16,185,129,0.3)" },
};

const categoryCounts: Record<string, number> = { Bug: 3, Feature: 5, Duplicate: 2, Question: 4, Docs: 2 };

export default function TriagePage() {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const filtered = activeCategory
    ? mockPriorityIssues.filter(i => i.category === activeCategory)
    : mockPriorityIssues;

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Issue Triage" subtitle="AI-powered categorization and duplicate detection" />

      <div className="p-6 max-w-6xl space-y-6">

        {/* Category filter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map(cat => {
            const s = categoryStyles[cat];
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(isActive ? null : cat)}
                className="glass-card rounded-xl p-4 text-center transition-card focus:outline-none"
                style={{ borderColor: isActive ? s.border : undefined, boxShadow: isActive ? `0 0 16px ${s.border}` : undefined }}>
                <p className="stat-number text-3xl mb-1" style={{ color: s.color }}>{categoryCounts[cat]}</p>
                <p className="text-xs font-medium" style={{ color: isActive ? s.color : "#606080" }}>{cat}</p>
              </button>
            );
          })}
        </div>

        {/* Toolbar */}
        <div className="flex items-center gap-3 flex-wrap">
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm flex-1 min-w-[200px]"
            style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: "#606080" }}>
            <Search className="w-3.5 h-3.5 flex-shrink-0" />
            <span>Search triage queue...</span>
          </div>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs btn-secondary">
            <SlidersHorizontal className="w-3.5 h-3.5" />Filter
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs btn-secondary">
            <RefreshCcw className="w-3.5 h-3.5" />Re-triage All
          </button>
          {activeCategory && (
            <button onClick={() => setActiveCategory(null)}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs"
              style={{ background: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)" }}>
              Clear filter ×
            </button>
          )}
        </div>

        {/* Triage Queue */}
        <div className="glass-card rounded-2xl p-5">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="font-display text-lg font-bold text-white">Triage Queue</h2>
              <p className="text-xs mt-0.5" style={{ color: "#606080" }}>
                {filtered.length} issue{filtered.length !== 1 ? "s" : ""} · AI auto-categorized
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {filtered.map(issue => {
              const cs = categoryStyles[issue.category];
              return (
                <div key={issue.id} className="p-4 rounded-xl transition-card" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Labels row */}
                      <div className="flex items-center gap-2 mb-2 flex-wrap">
                        <span className="text-xs px-2 py-0.5 rounded-full font-medium flex items-center gap-1"
                          style={{ background: cs.bg, color: cs.color, border: `1px solid ${cs.border}` }}>
                          🤖 Auto: {issue.category}
                        </span>
                        {issue.duplicateOf && (
                          <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ background: "rgba(245,158,11,0.12)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" }}>
                            <Copy className="w-3 h-3" />Possible Duplicate of #{issue.duplicateOf}
                          </span>
                        )}
                        <span className="text-xs" style={{ color: "#606080" }}>{issue.repo}</span>
                      </div>

                      <h3 className="font-semibold text-white mb-1.5 text-sm leading-snug">{issue.title}</h3>
                      <p className="text-xs leading-relaxed mb-3" style={{ color: "#A0A0C0" }}>{issue.aiSummary}</p>

                      {/* Contributor trust */}
                      <div className="flex items-center gap-3 text-xs flex-wrap" style={{ color: "#606080" }}>
                        <span>By <span className="text-purple-400 font-medium">@{issue.contributor.name}</span></span>
                        <span>Trust: <span className="font-semibold" style={{ color: issue.contributor.trustScore >= 80 ? "#10B981" : issue.contributor.trustScore >= 50 ? "#F59E0B" : "#EF4444" }}>{issue.contributor.trustScore}%</span></span>
                        <span>L{issue.contributor.level} · {issue.contributor.xp} XP</span>

                        {/* Trust indicator bar */}
                        <div className="flex items-center gap-1.5">
                          <div className="xp-bar h-1 w-16">
                            <div className="h-full rounded-full" style={{
                              width: `${issue.contributor.trustScore}%`,
                              background: issue.contributor.trustScore >= 80 ? "#10B981" : issue.contributor.trustScore >= 50 ? "#F59E0B" : "#EF4444"
                            }} />
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Category override panel */}
                    <div className="flex flex-col gap-1.5 flex-shrink-0 min-w-[90px]">
                      <p className="text-[10px] text-center uppercase tracking-widest mb-1" style={{ color: "#606080" }}>Override</p>
                      {categories.filter(c => c !== issue.category).slice(0, 3).map(cat => {
                        const s = categoryStyles[cat];
                        return (
                          <button key={cat} className="text-xs px-2 py-1 rounded-lg transition-colors"
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                            {cat}
                          </button>
                        );
                      })}
                      <button className="text-xs px-2 py-1 rounded-lg btn-secondary flex items-center justify-center gap-0.5">
                        More <ChevronDown className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-12">
                <p className="text-4xl mb-3">✅</p>
                <p className="font-display font-bold text-white">Queue clear for this category</p>
                <p className="text-sm mt-1" style={{ color: "#606080" }}>No issues need triaging right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Detector */}
        <div className="glass-card rounded-2xl p-5" style={{ borderColor: "rgba(245,158,11,0.2)" }}>
          <h2 className="font-display text-lg font-bold text-white mb-2 flex items-center gap-2">
            <AlertOctagon className="w-5 h-5 text-amber-400" />
            Duplicate Detector
          </h2>
          <p className="text-sm mb-4" style={{ color: "#A0A0C0" }}>
            Issues flagged as potential duplicates of existing open issues
          </p>

          {mockPriorityIssues.filter(i => i.duplicateOf).map(issue => (
            <div key={issue.id} className="p-4 rounded-xl mb-3" style={{ background: "rgba(245,158,11,0.07)", border: "1px solid rgba(245,158,11,0.2)" }}>
              <div className="flex items-start justify-between gap-4 mb-2">
                <p className="font-medium text-white text-sm">{issue.title}</p>
                <span className="text-xs px-2 py-0.5 rounded-full font-bold flex-shrink-0" style={{ background: "rgba(245,158,11,0.2)", color: "#FCD34D" }}>
                  87% similar
                </span>
              </div>
              <p className="text-xs mb-3" style={{ color: "#A0A0C0" }}>
                Likely duplicate of: <span className="text-amber-300">"Dropdown menu closes when clicking item in scrollable container"</span>{" "}
                (opened 3 weeks ago · 31 comments)
              </p>
              <div className="flex gap-2">
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: "rgba(239,68,68,0.15)", color: "#FCA5A5", border: "1px solid rgba(239,68,68,0.3)" }}>
                  Close as Duplicate
                </button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium btn-secondary">Keep Open</button>
                <button className="px-3 py-1.5 rounded-lg text-xs font-medium btn-secondary">Compare Side-by-Side</button>
              </div>
            </div>
          ))}
        </div>

      </div>
    </div>
  );
}
