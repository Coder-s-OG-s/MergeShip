"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { GitPullRequest, Star, MapPin, Calendar, ExternalLink, CheckCircle } from "lucide-react";
import { getProfileData } from "@/app/(contributor)/dashboard/actions";
import { createAppwriteAuthHeader } from "@/lib/appwrite-auth";
import { allAchievements } from "@/data/achievements";

export default function PortfolioPage() {
  const [profile, setProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      try {
        const authHeaders = await createAppwriteAuthHeader();
        const meResponse = await fetch("/api/me", {
          cache: "no-store",
          headers: authHeaders,
        });
        if (!meResponse.ok) {
          throw new Error("Unable to resolve authenticated profile.");
        }
        const mePayload = await meResponse.json();
        const githubHandle = mePayload?.profile?.github_handle;
        if (!githubHandle) {
          throw new Error("GitHub handle not available in profile.");
        }

        const data = await getProfileData(githubHandle);
        if (data.success) {
          setProfile(data);
        }
      } catch (e) {
        console.error(e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: "#060611" }}>
      <div className="w-12 h-12 border-4 border-[#A78BFA] border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!profile) return (
    <div className="min-h-screen flex items-center justify-center text-white" style={{ background: "#060611" }}>
      Failed to load profile.
    </div>
  );

  const { user, stats, skills, contributions } = profile;

  return (
    <div className="min-h-screen pb-20" style={{ background: "#060611" }}>
      <Topbar title="My Portfolio" subtitle="Public developer profile" />

      <div className="p-6 max-w-5xl space-y-6 mx-auto">
        {/* Profile card */}
        <div className="glass-card rounded-2xl p-8 border border-white/5 bg-[#121225]/50 backdrop-blur-xl">
          <div className="flex items-start gap-8 flex-wrap">
            <div className="relative">
              <img 
                src={user.avatar_url} 
                className="w-24 h-24 rounded-2xl object-cover ring-2 ring-[#A78BFA]/30 shadow-2xl" 
                alt={user.name}
              />
              <div className="absolute -bottom-2 -right-2 px-3 py-1 rounded-full text-xs font-black bg-gradient-to-br from-[#A78BFA] to-[#7C3AED] text-white shadow-lg">
                {stats.levelCode || "L1"}
              </div>
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 flex-wrap mb-2">
                <h1 className="font-display text-4xl font-black text-white tracking-tight">{user.name}</h1>
                <span className="px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 shadow-sm shadow-emerald-500/10">
                  ✓ Verified Contributor
                </span>
              </div>
              <p className="text-[#A78BFA] font-bold text-sm mb-3">@{user.github}</p>
              <p className="mb-6 text-gray-400 max-w-2xl leading-relaxed">{user.bio}</p>
              <div className="flex items-center gap-6 text-xs font-bold uppercase tracking-widest text-gray-500 flex-wrap">
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"><Calendar className="w-3.5 h-3.5" />Joined {user.joined}</span>
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"><MapPin className="w-3.5 h-3.5" />{user.location}</span>
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"><GitPullRequest className="w-3.5 h-3.5 text-emerald-400" />{user.mergedPRs} Merged</span>
                <span className="flex items-center gap-2 bg-white/5 px-3 py-1.5 rounded-lg border border-white/5"><Star className="w-3.5 h-3.5 text-amber-400" />{stats.totalXP} XP</span>
              </div>
            </div>

            <a href={`https://github.com/${user.github}`} target="_blank" rel="noreferrer"
              className="flex items-center gap-2 px-6 py-3 rounded-xl text-sm font-black uppercase tracking-widest bg-white text-black hover:bg-gray-200 transition-all shadow-xl shadow-white/5 ml-auto">
              <ExternalLink className="w-4 h-4" />
              View on GitHub
            </a>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Stats */}
          <div className="glass-card rounded-2xl p-6 space-y-5 border border-white/5 bg-[#121225]/30">
            <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-gray-500">Global Stats</h2>
            {[
              { label: "Total XP", value: stats.totalXP, color: "#A78BFA" },
              { label: "Current Level", value: stats.level || `${stats.levelCode || "L1"} ${stats.levelTitle || "Beginner"}`, color: "#06B6D4" },
              { label: "Issues Solved", value: stats.issuesSolved, color: "#10B981" },
              { label: "PRs Merged", value: stats.prsMerged, color: "#10B981" },
              { label: "Current Streak", value: `${stats.streak} days 🔥`, color: "#F59E0B" },
              { label: "Longest Streak", value: `${stats.longestStreak} days`, color: "#F59E0B" },
            ].map(s => (
              <div key={s.label} className="flex items-center justify-between border-b border-white/5 pb-3 last:border-0 last:pb-0">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-400">{s.label}</span>
                <span className="text-sm font-black" style={{ color: s.color }}>{s.value}</span>
              </div>
            ))}
          </div>

          {/* Skill bars */}
          <div className="glass-card rounded-2xl p-6 lg:col-span-2 border border-white/5 bg-[#121225]/30">
            <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">Language Ecosystem</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
              {skills.map((skill: { name: string; level: number }) => (
                <div key={skill.name}>
                  <div className="flex justify-between text-[11px] font-black uppercase tracking-widest mb-2.5">
                    <span className="text-gray-300">{skill.name}</span>
                    <span className="text-[#A78BFA]">{skill.level}%</span>
                  </div>
                  <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                    <div className="h-full rounded-full bg-gradient-to-r from-[#7C3AED] to-[#A78BFA]" style={{ width: `${skill.level}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Contribution history */}
        <div className="glass-card rounded-2xl p-8 border border-white/5 bg-[#121225]/30">
          <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-gray-500 mb-8">Merged Pull Requests</h2>
          <div className="space-y-6">
            {contributions.length > 0 ? contributions.map((c: any, i: number) => (
              <a key={i} href={c.url} target="_blank" rel="noreferrer" className="flex items-start gap-6 relative group cursor-pointer">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 z-10 transition-transform group-hover:scale-110 shadow-lg"
                  style={{
                    background: "rgba(16,185,129,0.1)",
                    border: "1px solid rgba(16,185,129,0.2)"
                  }}>
                  <CheckCircle className="w-5 h-5 text-emerald-400" />
                </div>
                <div className="flex-1 pb-6 border-b border-white/5 last:border-0">
                  <div className="flex items-center justify-between gap-4 mb-2">
                    <h3 className="font-bold text-white text-lg group-hover:text-[#A78BFA] transition-colors line-clamp-1">{c.title}</h3>
                    <span className="text-xs font-black uppercase tracking-widest text-[#A78BFA] bg-[#A78BFA]/10 px-3 py-1 rounded-full whitespace-nowrap">+{c.xp} XP</span>
                  </div>
                  <p className="text-xs font-bold uppercase tracking-[0.15em] text-gray-500">{c.repo} · Merged {c.merged}</p>
                </div>
              </a>
            )) : (
              <p className="text-gray-500 text-sm font-bold uppercase tracking-widest italic py-4">No community contributions recorded yet.</p>
            )}
          </div>
        </div>

        {/* Achievements */}
        <div className="glass-card rounded-2xl p-8 border border-white/5 bg-[#121225]/30">
          <h2 className="font-display font-black text-xs uppercase tracking-[0.2em] text-gray-500 mb-6">Unlocked Badges</h2>
          <div className="flex flex-wrap gap-4">
            {allAchievements.filter(a => a.unlocked).map(a => (
              <div key={a.id} className="flex items-center gap-3 px-5 py-3 rounded-2xl border border-white/10 bg-white/5 hover:border-[#A78BFA]/30 transition-all cursor-default shadow-lg">
                <span className="text-2xl drop-shadow-[0_0_8px_rgba(255,255,255,0.3)]">{a.emoji}</span>
                <span className="text-xs font-black uppercase tracking-widest text-white">{a.title}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

