"use client";

import { useEffect, useState } from "react";
import { Star, Clock, Bookmark, BookmarkCheck, ExternalLink, Zap, Filter, GitCommit, MessageSquare, ShieldCheck, ChevronDown, Sparkles } from "lucide-react";
import { getContributorContext, getAnalyzedIssues } from "@/app/(contributor)/dashboard/actions";
import { account } from "@/lib/appwrite";
import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";

const difficultyConfig = {
  EASY: { label: "EASY", color: "#4ADE80", bg: "rgba(74,222,128,0.1)", dot: "#4ADE80", tier: "EASY PICKINGS" },
  MEDIUM: { label: "MEDIUM", color: "#FACC15", bg: "rgba(250,204,21,0.1)", dot: "#FACC15", tier: "STANDARD QUESTS" },
  HARD: { label: "HARD", color: "#EF4444", bg: "rgba(239,68,68,0.1)", dot: "#EF4444", tier: "ELITE CHALLENGES" },
};

export default function IssuesPage() {
  const [filter, setFilter] = useState<"all" | "EASY" | "MEDIUM" | "HARD">("all");
  const [repos, setRepos] = useState<any[]>([]);
  const [selectedRepo, setSelectedRepo] = useState("");
  const [issues, setIssues] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bookmarks, setBookmarks] = useState<Set<string>>(new Set());
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  const [ghToken, setGhToken] = useState("");

  useEffect(() => {
    const init = async () => {
      try {
        const session = await account.get();
        const handle = session.name.replace(/\s+/g, '-').toLowerCase();
        
        // Resolve the REAL GitHub username and token
        let githubHandle = handle;
        let token = "";
        try {
          const identities = await account.listIdentities();
          const gh = identities.identities.find(id => id.provider.toLowerCase() === 'github');
          if (gh) {
            token = (gh as any).providerAccessToken;
            setGhToken(token);
            
            if (session.name.toLowerCase().includes("ayush patel")) {
              githubHandle = "Ayush-Patel-56";
            } else {
              const res = await fetch(`https://api.github.com/user/${gh.providerUid}`);
              if (res.ok) {
                const data = await res.json();
                githubHandle = data.login;
              }
            }
          } else if (session.name.toLowerCase().includes("ayush patel")) {
             githubHandle = "Ayush-Patel-56";
          }
        } catch (e) {
          console.error("[MergeShip] Identity resolution failed:", e);
        }

        const data = await getContributorContext(githubHandle, token);
        if (data.success && data.repos.length > 0) {
          setRepos(data.repos);
          setSelectedRepo(data.repos[0].value);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  useEffect(() => {
    if (selectedRepo) {
      const fetchIssues = async () => {
        setLoading(true);
        const res = await getAnalyzedIssues(selectedRepo, "INTERMEDIATE", false, 9, ghToken);
        if (res.success) {
          setIssues(res.issues);
        }
        setLoading(false);
      };
      fetchIssues();
    }
  }, [selectedRepo, ghToken]);

  const visible = filter === "all" ? issues : issues.filter(i => i.difficulty === filter);

  const toggleBookmark = (id: string) => {
    setBookmarks(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const easy = visible.filter(i => i.difficulty === "EASY");
  const medium = visible.filter(i => i.difficulty === "MEDIUM");
  const hard = visible.filter(i => i.difficulty === "HARD");

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
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
            <GitCommit className="w-4 h-4 text-emerald-400" />
            <span className="text-xs font-bold text-emerald-400">Personal Projects</span>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#D8B4FE]/10 border border-[#D8B4FE]/20">
            <Sparkles className="w-4 h-4 text-[#D8B4FE]" />
            <span className="text-xs font-bold text-[#D8B4FE]">Owned by You</span>
          </div>
        </div>
      </div>

      <div className="space-y-10">
        {/* Filter bar and Repo Selector */}
        <div className="flex flex-col md:flex-row items-center gap-6 justify-between flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-xl" style={{ background: "#1E1826", border: "1px solid rgba(255,255,255,0.05)" }}>
            {(["all", "EASY", "MEDIUM", "HARD"] as const).map(f => (
              <button key={f}
                onClick={() => setFilter(f)}
                className={`px-6 py-2 rounded-lg text-sm font-bold transition-all capitalize ${filter === f ? "bg-[#D8B4FE] text-[#15111A]" : "text-[#8B7E9F] hover:text-white"}`}
              >
                {f === "all" ? "All Issues" : `${difficultyConfig[f].label}`}
              </button>
            ))}
          </div>

          <div className="relative">
            <button 
              onClick={() => setIsDropdownOpen(!isDropdownOpen)}
              className="flex items-center gap-3 px-5 py-2.5 rounded-xl border border-white/10 bg-[#1E1826] hover:bg-[#2A2136] transition-all group"
            >
              <div className="w-5 h-5 rounded-full bg-gradient-to-br from-[#B78AF7] to-[#7C3AED] flex items-center justify-center p-1">
                <Sparkles className="w-full h-full text-white" />
              </div>
              <span className="text-xs font-bold text-white tracking-wide uppercase">
                Network: <span className="text-[#D8B4FE] ml-2">{selectedRepo}</span>
              </span>
              <ChevronDown className={`w-4 h-4 text-[#8B7E9F] transition-transform ${isDropdownOpen ? 'rotate-180' : ''}`} />
            </button>

            {isDropdownOpen && (
              <div className="absolute top-full right-0 mt-2 w-72 bg-[#1E1826] border border-white/10 rounded-xl shadow-2xl z-50 py-2 overflow-hidden">
                <div className="max-h-60 overflow-y-auto custom-scrollbar">
                  {repos.map((r) => (
                    <button
                      key={r.value}
                      onClick={() => {
                        setSelectedRepo(r.value);
                        setIsDropdownOpen(false);
                      }}
                      className={`w-full text-left px-5 py-3 text-xs font-bold transition-colors hover:bg-white/5 ${selectedRepo === r.value ? 'text-[#D8B4FE] bg-white/5' : 'text-[#8B7E9F]'}`}
                    >
                      {r.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
          <div className="ml-auto flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold"
            style={{ background: "#1E1826", border: "1px solid rgba(255,255,255,0.05)", color: "#D8B4FE" }}>
            <Filter className="w-4 h-4" />
            <span>{visible.length} issues shown</span>
          </div>
        </div>

        {/* Tier sections */}
        {loading ? (
           <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             {[1,2,3].map(i => (
               <div key={i} className="h-64 rounded-2xl bg-white/5 animate-pulse border border-white/5" />
             ))}
           </div>
        ) : [
          { items: easy, diff: "EASY" as const },
          { items: medium, diff: "MEDIUM" as const },
          { items: hard, diff: "HARD" as const },
        ].map(section => (
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
                const cfg = difficultyConfig[issue.difficulty as keyof typeof difficultyConfig];
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
                  <Link 
                    key={issue.url} 
                    href={issue.url} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="no-underline block"
                  >
                    <div className="rounded-2xl p-5 border border-white/5 hover:border-[#D8B4FE]/30 transition-colors cursor-pointer flex flex-col gap-4 h-full" style={{ background: "#1E1826" }}>
                      
                      {/* Header */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-2 text-[#8B7E9F] text-xs font-medium">
                            <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 text-white">
                              <span className="text-[10px]">{issue.repo.charAt(0).toUpperCase()}</span>
                            </div>
                            <span>{issue.repo}</span>
                          </div>
                          <h3 className="font-bold text-white text-base leading-snug mb-3 group-hover:text-[#D8B4FE] transition-colors">{issue.title}</h3>
                          
                          {/* AI Highlight Badge */}
                          <div className={`flex items-center gap-1.5 px-2 py-1 rounded w-fit border ${networkBg} ${networkBorder} mb-3`}>
                            <NetworkIcon className={`w-3 h-3 ${networkColor}`} />
                            <span className={`text-[10px] font-bold ${networkColor} font-sans tracking-wide`}>
                              {issue.highlight || "Matches your current track"}
                            </span>
                          </div>
                          
                          <div className="flex flex-wrap gap-2">
                            <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: cfg.bg, color: cfg.color }}>{cfg.label}</span>
                            {issue.labels?.slice(0, 2).map((l: string) => (
                              <span key={l} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">{l}</span>
                            ))}
                          </div>
                        </div>
                        <button onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleBookmark(issue.url) }} className="flex-shrink-0 p-1.5 rounded-lg hover:bg-white/5 transition-colors">
                          {isBookmarked
                            ? <BookmarkCheck className="w-4 h-4" style={{ color: "#D8B4FE" }} />
                            : <Bookmark className="w-4 h-4 text-[#8B7E9F]" />
                          }
                        </button>
                      </div>

                      {/* Footer */}
                      <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
                        <span className="text-[#8B7E9F] flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5" />
                          {issue.time}
                        </span>
                        <span className="text-[#D8B4FE] flex items-center gap-1.5">
                          <Zap className="w-3.5 h-3.5" />
                          +{issue.xp} XP
                        </span>
                      </div>

                    </div>
                  </Link>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
