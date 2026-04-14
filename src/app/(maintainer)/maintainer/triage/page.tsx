"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Copy, AlertOctagon, RefreshCcw, Search, SlidersHorizontal, ChevronDown, Filter, Trash2, CheckCircle, ExternalLink } from "lucide-react";
import { account } from "@/lib/appwrite";
import { getTriageData, triageIssue, closeDuplicate } from "../actions";

const categories = ["Bug", "Feature", "Duplicate", "Question", "Docs"] as const;
const categoryStyles: Record<string, { bg: string; color: string; border: string }> = {
  Bug: { bg: "rgba(239,68,68,0.12)", color: "#FCA5A5", border: "rgba(239,68,68,0.3)" },
  Feature: { bg: "rgba(6,182,212,0.12)", color: "#67E8F9", border: "rgba(6,182,212,0.3)" },
  Duplicate: { bg: "rgba(245,158,11,0.12)", color: "#FCD34D", border: "rgba(245,158,11,0.3)" },
  Question: { bg: "rgba(124,58,237,0.12)", color: "#C4B5FD", border: "rgba(124,58,237,0.3)" },
  Docs: { bg: "rgba(16,185,129,0.12)", color: "#6EE7B7", border: "rgba(16,185,129,0.3)" },
};

export default function TriagePage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [selectedRepo, setSelectedRepo] = useState<string>("");
  const [userToken, setUserToken] = useState<string>("");
  const [actionLoading, setActionLoading] = useState<number | null>(null);

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
          } else {
            const res = await fetch(`https://api.github.com/user/${gh.providerUid}`);
            if (res.ok) {
              const d = await res.json();
              handle = d.login;
            }
          }
        } else if (session.name.toLowerCase().includes("ayush patel")) {
           handle = "Ayush-Patel-56";
        }

        const res = await getTriageData(handle, token, selectedRepo);
        if (res.success) {
          setData(res);
          if (!selectedRepo) setSelectedRepo(res.repoName);
          setUserToken(token);
        }
      } catch (e) {
        console.error("Triage init failed", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, [selectedRepo]);

  const handleTriage = async (issueNumber: number, category: string) => {
    if (!selectedRepo || !userToken) return;
    setActionLoading(issueNumber);
    const res = await triageIssue(selectedRepo, issueNumber, category, userToken);
    if (res.success) {
      // Optimitically update UI or just refresh
      const refreshedData = await getTriageData("", userToken, selectedRepo);
      if (refreshedData.success) setData(refreshedData);
    }
    setActionLoading(null);
  };

  const handleCloseDuplicate = async (issueNumber: number, duplicateOf: string) => {
    if (!selectedRepo || !userToken) return;
    setActionLoading(issueNumber);
    const res = await closeDuplicate(selectedRepo, issueNumber, duplicateOf, userToken);
    if (res.success) {
      const refreshedData = await getTriageData("", userToken, selectedRepo);
      if (refreshedData.success) setData(refreshedData);
    }
    setActionLoading(null);
  };

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#060611]">
      <div className="w-12 h-12 border-4 border-amber-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data || data.empty) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060611] text-white p-6 text-center">
      <h1 className="text-2xl font-black mb-4 uppercase tracking-widest">No Issues to Triage</h1>
      <p className="text-gray-400 max-w-md">Your maintained repositories are clear of open issues needing triage!</p>
    </div>
  );

  const filtered = activeCategory
    ? data.triageQueue.filter((i: any) => i.category === activeCategory)
    : data.triageQueue;

  return (
    <div className="min-h-screen" style={{ background: "#060611" }}>
      <Topbar title="Issue Triage" subtitle={`Categorizing ${data.repoName} issues`} />

      <div className="p-6 max-w-6xl space-y-8 mx-auto">

        {/* Header & Repo Filter */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-2 p-1.5 rounded-2xl w-fit bg-white/5 border border-white/10 shadow-inner">
             <div className="px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest text-[#606080] border border-transparent">
               Active Repository: <span className="text-white ml-2">{data.repoName.split('/')[1] || data.repoName}</span>
             </div>
          </div>

          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-amber-500/20 to-orange-500/20 rounded-2xl blur opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="relative flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/5 border border-white/10 text-white min-w-[240px]">
              <Filter className="w-3.5 h-3.5 text-amber-400" />
              <select 
                value={selectedRepo}
                onChange={(e) => setSelectedRepo(e.target.value)}
                className="bg-transparent border-none outline-none text-[10px] font-black uppercase tracking-widest w-full appearance-none cursor-pointer pr-8"
              >
                {data.allRepoNames?.map((r: string) => (
                  <option key={r} value={r} className="bg-[#060611] text-white">
                    {r.split('/')[1] || r}
                  </option>
                ))}
              </select>
              <ChevronDown className="w-3.5 h-3.5 text-[#606080] absolute right-4 pointer-events-none" />
            </div>
          </div>
        </div>

        {/* Category filter cards */}
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
          {categories.map(cat => {
            const s = categoryStyles[cat];
            const isActive = activeCategory === cat;
            return (
              <button key={cat} onClick={() => setActiveCategory(isActive ? null : cat)}
                className="glass-card rounded-xl p-4 text-center transition-all bg-white/5 border border-white/5 hover:border-white/10"
                style={{ borderColor: isActive ? s.border : undefined, boxShadow: isActive ? `0 0 16px ${s.border}` : undefined }}>
                <p className="stat-number text-3xl mb-1 font-black" style={{ color: s.color }}>{data.categoryCounts[cat] || 0}</p>
                <p className="text-[10px] font-black uppercase tracking-widest" style={{ color: isActive ? s.color : "#606080" }}>{cat}</p>
              </button>
            );
          })}
        </div>

        {/* Triage Queue */}
        <div className="glass-card rounded-2xl p-6 bg-[#110E15]/60 backdrop-blur-md border border-white/5">
          <div className="flex items-center justify-between mb-8">
            <div>
              <h2 className="font-display text-xl font-black text-white uppercase tracking-tighter">Triage Queue</h2>
              <p className="text-[10px] mt-1 font-bold text-[#606080] uppercase tracking-widest">
                {filtered.length} issue{filtered.length !== 1 ? "s" : ""} · AI auto-categorized
              </p>
            </div>
          </div>
          <div className="space-y-4">
            {filtered.map((issue: any) => {
              const cs = categoryStyles[issue.category] || categoryStyles.Question;
              return (
                <div key={issue.id} className="p-5 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-all">
                  <div className="flex items-start justify-between gap-6 flex-wrap">
                    <div className="flex-1 min-w-0">
                      {/* Labels row */}
                      <div className="flex items-center gap-3 mb-3 flex-wrap">
                        <span className="text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest border"
                          style={{ background: cs.bg, color: cs.color, borderColor: cs.border }}>
                          🤖 Auto: {issue.category}
                        </span>
                        {issue.duplicateOf && (
                          <span className="flex items-center gap-1.5 text-[10px] px-2.5 py-1 rounded-full font-black uppercase tracking-widest"
                            style={{ background: "rgba(245,158,11,0.12)", color: "#FCD34D", border: "1px solid rgba(245,158,11,0.3)" }}>
                            <Copy className="w-3.5 h-3.5" />Possible Duplicate of #{issue.duplicateOf}
                          </span>
                        )}
                        <span className="text-[10px] font-bold text-[#606080] uppercase tracking-widest">{issue.repo}</span>
                      </div>

                      <h3 className="font-bold text-white mb-2 text-base leading-snug">{issue.title}</h3>
                      <p className="text-xs leading-relaxed mb-4 text-[#A0A0C0] opacity-80 font-medium">{issue.aiSummary}</p>

                      {/* Contributor trust */}
                      <div className="flex items-center gap-6 text-[10px] font-bold text-[#606080] uppercase tracking-widest flex-wrap">
                        <span>By <span className="text-purple-400">@{issue.contributor.name}</span></span>
                        <span>Trust: <span style={{ color: issue.contributor.trustScore >= 80 ? "#10B981" : issue.contributor.trustScore >= 50 ? "#F59E0B" : "#EF4444" }}>{issue.contributor.trustScore}%</span></span>
                        <span>L{issue.contributor.level} · {issue.contributor.xp} XP</span>
                      </div>
                    </div>

                    {/* Category override panel */}
                    <div className="flex flex-col gap-2 flex-shrink-0 min-w-[120px]">
                      <p className="text-[8px] text-center font-black uppercase tracking-[0.2em] mb-1 text-[#606080]">Override</p>
                      {categories.filter(c => c !== issue.category).slice(0, 3).map(cat => {
                        const s = categoryStyles[cat];
                        const isLoading = actionLoading === issue.id;
                        return (
                          <button 
                            key={cat} 
                            disabled={isLoading}
                            onClick={() => handleTriage(issue.id, cat)}
                            className={`text-[10px] px-3 py-1.5 rounded-xl font-black uppercase tracking-widest transition-all ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}`}
                            style={{ background: s.bg, color: s.color, border: `1px solid ${s.border}` }}>
                            {cat}
                          </button>
                        );
                      })}
                      <button 
                         disabled={actionLoading === issue.id}
                         onClick={() => handleTriage(issue.id, issue.category)}
                         className="flex items-center justify-center gap-2 mt-2 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 hover:bg-emerald-500 hover:text-white transition-all">
                        <CheckCircle className="w-3.5 h-3.5" /> Confirm
                      </button>
                      <a 
                        href={issue.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 mt-1 px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white border border-white/5 hover:bg-white/10 transition-all">
                        <ExternalLink className="w-3.5 h-3.5" /> View
                      </a>
                    </div>
                  </div>
                </div>
              );
            })}

            {filtered.length === 0 && (
              <div className="text-center py-16">
                <p className="text-5xl mb-4">✨</p>
                <p className="font-display font-black text-white uppercase tracking-widest">Queue clear for this category</p>
                <p className="text-[10px] mt-2 font-bold text-[#606080] uppercase tracking-widest">No issues need triaging right now.</p>
              </div>
            )}
          </div>
        </div>

        {/* Duplicate Detector */}
        <div className="glass-card rounded-2xl p-8 bg-[#110E15]/60 backdrop-blur-md border border-amber-500/20">
          <h2 className="font-display text-xl font-black text-white uppercase tracking-tighter mb-2 flex items-center gap-3">
            <AlertOctagon className="w-6 h-6 text-amber-400 shadow-lg shadow-amber-400/20" />
            Duplicate Detector
          </h2>
          <p className="text-[10px] mb-8 font-black text-[#606080] uppercase tracking-widest opacity-80 border-b border-white/5 pb-4">
            Issues flagged as potential duplicates of existing open issues
          </p>

          <div className="space-y-4">
            {data.triageQueue.filter((i: any) => i.duplicateOf).map((issue: any) => (
              <div key={issue.id} className="p-6 rounded-2xl transition-all bg-amber-500/5 border border-amber-500/10">
                <div className="flex items-start justify-between gap-6 mb-4">
                  <p className="font-bold text-white text-base leading-snug">{issue.title}</p>
                  <span className="text-[10px] px-3 py-1 rounded-full font-black uppercase tracking-widest bg-amber-500/20 text-amber-400 border border-amber-500/20 whitespace-nowrap">
                    87% similar
                  </span>
                </div>
                <p className="text-xs text-[#A0A0C0] mb-6 font-medium leading-relaxed italic opacity-80">
                  Likely duplicate of: <span className="text-amber-300 font-bold underline underline-offset-4 pointer-events-none cursor-default">"Dropdown menu closes when clicking item in scrollable container"</span>{" "}
                  (opened 3 weeks ago · 31 comments)
                </p>
                <div className="flex gap-2 flex-wrap">
                  <button 
                    disabled={actionLoading === issue.id}
                    onClick={() => handleCloseDuplicate(issue.id, issue.duplicateOf)}
                    className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-500 border border-amber-500/20 hover:bg-amber-500 hover:text-[#110E15] transition-all disabled:opacity-50">
                    {actionLoading === issue.id ? "Processing..." : "Close as Duplicate"}
                  </button>
                  <button className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white hover:bg-white/10 transition-all">Keep Open</button>
                  <button className="px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest bg-white/5 text-white hover:bg-white/10 transition-all">Compare Side-by-Side</button>
                </div>
              </div>
            ))}
          </div>
        </div>

      </div>
    </div>
  );
}

