"use client";

import { useState } from "react";
import { Trophy, Medal, Star, TrendingUp, ChevronUp, ChevronDown, GitCommit } from "lucide-react";

// Inline mock data for exactly what's needed
const monthData = [
  { rank: 1, name: "Alex Rivera", level: 9, handle: "@arivera", xp: "14,250", merged: 42, topSkill: "TypeScript", trend: "up" },
  { rank: 2, name: "David Kim", level: 8, handle: "@dkim_dev", xp: "12,190", merged: 35, topSkill: "Rust", trend: "up" },
  { rank: 3, name: "Sarah Chen", level: 9, handle: "@sarahc", xp: "11,500", merged: 28, topSkill: "React", trend: "down" },
  { rank: 4, name: "Emma Wilson", level: 8, handle: "@emmaw", xp: "9,100", merged: 25, topSkill: "Python", trend: "same" },
  { rank: 5, name: "James Anderson", level: 7, handle: "@jando", xp: "8,900", merged: 21, topSkill: "Node.js", trend: "up" },
  { rank: 6, name: "Jessica Taylor", level: 7, handle: "@jt_codes", xp: "8,400", merged: 19, topSkill: "Vue.js", trend: "same" },
  { rank: 7, name: "Michael Chang", level: 7, handle: "@mchang", xp: "7,200", merged: 18, topSkill: "Go", trend: "down" },
  { rank: 8, name: "Emily Davis", level: 6, handle: "@emilyd", xp: "6,750", merged: 16, topSkill: "CSS", trend: "up" },
  { rank: 9, name: "Daniel Martinez", level: 6, handle: "@dmartinez", xp: "5,300", merged: 12, topSkill: "C++", trend: "down" },
  { rank: 10, name: "Sophia Garcia", level: 6, handle: "@sophiag", xp: "4,800", merged: 10, topSkill: "JavaScript", trend: "up" },
];

const allTimeData = [
  { rank: 1, name: "Sarah Chen", level: 9, handle: "@sarahc", xp: "341,190", merged: 1215, topSkill: "React", trend: "up" },
  { rank: 2, name: "Alex Rivera", level: 9, handle: "@arivera", xp: "284,250", merged: 942, topSkill: "TypeScript", trend: "down" },
  { rank: 3, name: "Michael Chang", level: 7, handle: "@mchang", xp: "168,900", merged: 510, topSkill: "Go", trend: "up" },
  { rank: 4, name: "David Kim", level: 8, handle: "@dkim_dev", xp: "176,500", merged: 698, topSkill: "Rust", trend: "down" },
  { rank: 5, name: "Emma Wilson", level: 8, handle: "@emmaw", xp: "152,100", merged: 445, topSkill: "Python", trend: "same" },
  { rank: 6, name: "Jessica Taylor", level: 7, handle: "@jt_codes", xp: "145,400", merged: 398, topSkill: "Vue.js", trend: "same" },
  { rank: 7, name: "James Anderson", level: 7, handle: "@jando", xp: "121,200", merged: 384, topSkill: "Node.js", trend: "down" },
  { rank: 8, name: "Emily Davis", level: 6, handle: "@emilyd", xp: "98,750", merged: 265, topSkill: "CSS", trend: "up" },
  { rank: 9, name: "Daniel Martinez", level: 6, handle: "@dmartinez", xp: "84,300", merged: 252, topSkill: "C++", trend: "down" },
  { rank: 10, name: "Sophia Garcia", level: 6, handle: "@sophiag", xp: "71,800", merged: 240, topSkill: "JavaScript", trend: "up" },
];

export default function LeaderboardPage() {
  const [timeframe, setTimeframe] = useState<"month" | "all">("month");
  
  const currentData = timeframe === "month" ? monthData : allTimeData;
  const topThree = currentData.slice(0, 3);
  const others = currentData.slice(3);

  return (
    <div className="max-w-[1200px] mx-auto p-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Global Leaderboard</h1>
          <p className="text-[#8B7E9F]">Rankings are updated daily based on validated PR merges and complexity scores.</p>
        </div>
        <div className="flex items-center gap-2 bg-[#1E1826] p-1.5 rounded-xl border border-white/5">
          <button 
            onClick={() => setTimeframe("month")}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${timeframe === "month" ? "bg-[#D8B4FE] text-[#15111A]" : "text-[#8B7E9F] hover:text-white"}`}>
            This Month
          </button>
          <button 
            onClick={() => setTimeframe("all")}
            className={`px-5 py-2 rounded-lg text-sm font-bold transition-colors ${timeframe === "all" ? "bg-[#D8B4FE] text-[#15111A]" : "text-[#8B7E9F] hover:text-white"}`}>
            All Time
          </button>
        </div>
      </div>

      {/* Top 3 Podium */}
      <div className="flex flex-col md:flex-row items-end justify-center gap-6 mb-16 pt-10">
        
        {/* Rank 2 (Silver) */}
        <div className="w-full md:w-64 flex flex-col items-center order-2 md:order-1 relative group">
          <div className="absolute -top-6 w-8 h-8 rounded-full bg-[#E2E8F0] text-[#475569] flex flex-col items-center justify-center font-bold text-xs shadow-[0_0_20px_rgba(226,232,240,0.5)] z-10 border-2 border-[#15111A]">2</div>
          <div className="bg-[#1E1826] border border-white/5 rounded-t-3xl w-full flex flex-col items-center p-8 pb-10 transition-transform group-hover:-translate-y-2 relative overflow-hidden" style={{ minHeight: "220px" }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#E2E8F0] to-transparent opacity-50" />
            <div className="w-20 h-20 rounded-full bg-[#2A2136] border-4 border-[#15111A] flex items-center justify-center text-xl font-bold text-white mb-4 shadow-xl">
              {topThree[1].name.split(" ").map(n => n[0]).join("")}
            </div>
            <h3 className="font-bold text-white text-lg">{topThree[1].name}</h3>
            <span className="text-xs text-[#8B7E9F] mb-4">{topThree[1].handle}</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/5 font-mono text-sm text-[#E2E8F0] font-bold">
              <Star className="w-3.5 h-3.5" /> {topThree[1].xp} XP
            </div>
          </div>
        </div>

        {/* Rank 1 (Gold) */}
        <div className="w-full md:w-72 flex flex-col items-center order-1 md:order-2 relative group z-10">
          <div className="absolute -top-10 w-12 h-12 rounded-full bg-[#FBBF24] text-[#78350F] flex flex-col items-center justify-center font-bold text-lg shadow-[0_0_30px_rgba(251,191,36,0.5)] z-10 border-4 border-[#15111A]"><Trophy className="w-5 h-5" /></div>
          <div className="bg-gradient-to-b from-[#2A2136] to-[#1E1826] border border-[#D8B4FE]/30 rounded-t-[2.5rem] w-full flex flex-col items-center p-8 pb-14 transition-transform group-hover:-translate-y-2 relative overflow-hidden shadow-2xl" style={{ minHeight: "260px" }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#FBBF24] to-transparent" />
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-48 h-48 bg-[#D8B4FE]/10 rounded-full blur-[50px] pointer-events-none" />
            <div className="w-24 h-24 rounded-full bg-[#15111A] border-4 border-[#FBBF24] flex items-center justify-center text-3xl font-bold text-white mb-4 shadow-xl">
              {topThree[0].name.split(" ").map(n => n[0]).join("")}
            </div>
            <h3 className="font-bold text-white text-xl">{topThree[0].name}</h3>
            <span className="text-xs text-[#D8B4FE] font-bold mb-4 tracking-widest uppercase">Level {topThree[0].level} Master</span>
            <div className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#FBBF24]/10 border border-[#FBBF24]/20 font-mono text-base text-[#FBBF24] font-bold">
              <Star className="w-4 h-4" /> {topThree[0].xp} XP
            </div>
          </div>
        </div>

        {/* Rank 3 (Bronze) */}
        <div className="w-full md:w-64 flex flex-col items-center order-3 relative group">
          <div className="absolute -top-6 w-8 h-8 rounded-full bg-[#D4A373] text-[#5C3A21] flex flex-col items-center justify-center font-bold text-xs shadow-[0_0_20px_rgba(212,163,115,0.4)] z-10 border-2 border-[#15111A]">3</div>
          <div className="bg-[#1E1826] border border-white/5 rounded-t-3xl w-full flex flex-col items-center p-8 pb-6 transition-transform group-hover:-translate-y-2 relative overflow-hidden" style={{ minHeight: "190px" }}>
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#D4A373] to-transparent opacity-50" />
            <div className="w-16 h-16 rounded-full bg-[#2A2136] border-4 border-[#15111A] flex items-center justify-center text-lg font-bold text-white mb-4 shadow-xl">
              {topThree[2].name.split(" ").map(n => n[0]).join("")}
            </div>
            <h3 className="font-bold text-white text-base">{topThree[2].name}</h3>
            <span className="text-xs text-[#8B7E9F] mb-4">{topThree[2].handle}</span>
            <div className="flex items-center gap-1.5 px-3 py-1 rounded bg-white/5 font-mono text-xs text-[#D4A373] font-bold">
              <Star className="w-3.5 h-3.5" /> {topThree[2].xp} XP
            </div>
          </div>
        </div>

      </div>

      {/* List Rankings */}
      <div className="bg-[#1E1826] border border-white/5 rounded-3xl overflow-hidden mb-12">
        {/* Table Header */}
        <div className="grid grid-cols-12 gap-4 p-5 border-b border-white/5 text-[10px] font-bold tracking-widest text-[#8B7E9F] bg-[#15111A]/50">
          <div className="col-span-1 text-center">RANK</div>
          <div className="col-span-5">CONTRIBUTOR</div>
          <div className="col-span-2 hidden md:block text-center">MERGED PRs</div>
          <div className="col-span-2 hidden md:block text-center">TOP SKILL</div>
          <div className="col-span-4 md:col-span-2 text-right pr-4">TOTAL XP</div>
        </div>

        {/* Table Body */}
        <div className="flex flex-col">
          {others.map((user) => (
            <div key={user.rank} className="grid grid-cols-12 gap-4 p-5 border-b border-white/5 items-center hover:bg-white/5 transition-colors group">
              
              <div className="col-span-1 flex items-center justify-center gap-1">
                <span className="font-mono text-sm text-[#8B7E9F] font-bold w-4 text-center">{user.rank}</span>
                {user.trend === "up" && <ChevronUp className="w-3 h-3 text-[#4ADE80]" />}
                {user.trend === "down" && <ChevronDown className="w-3 h-3 text-[#EF4444]" />}
                {user.trend === "same" && <div className="w-3 h-[2px] bg-[#8B7E9F]/50 rounded-full" />}
              </div>

              <div className="col-span-5 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-[#2A2136] flex items-center justify-center text-xs font-bold text-white border border-white/10 group-hover:border-[#D8B4FE]/50 transition-colors">
                  {user.name.split(" ").map(n => n[0]).join("")}
                </div>
                <div>
                  <h4 className="font-bold text-white text-sm">{user.name}</h4>
                  <div className="flex items-center gap-2 mt-1">
                    <span className="text-[10px] font-bold px-1.5 rounded bg-white/5 text-[#D8B4FE]">L{user.level}</span>
                    <span className="text-xs text-[#8B7E9F]">{user.handle}</span>
                  </div>
                </div>
              </div>

              <div className="col-span-2 hidden md:flex items-center justify-center gap-1.5 text-sm font-medium text-[#8B7E9F]">
                <GitCommit className="w-4 h-4 opacity-50" />
                {user.merged}
              </div>

              <div className="col-span-2 hidden md:flex items-center justify-center">
                <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-white/5 text-[#8B7E9F] border border-white/5">
                  {user.topSkill}
                </span>
              </div>

              <div className="col-span-4 md:col-span-2 flex justify-end items-center pr-4">
                <span className="font-mono text-sm font-bold text-white group-hover:text-[#D8B4FE] transition-colors">{user.xp} <span className="text-[#8B7E9F] text-xs font-sans font-medium">XP</span></span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Floating Action / Current User Sticky Banner (Optional highlight) */}
      <div className="sticky bottom-8 max-w-2xl mx-auto rounded-2xl bg-gradient-to-r from-[#D8B4FE] to-[#9333EA] p-[1px] shadow-2xl animate-fade-in">
        <div className="bg-[#15111A] rounded-[15px] p-4 px-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-10 h-10 rounded-full bg-[#D8B4FE] text-[#15111A] flex items-center justify-center font-bold text-sm">JD</div>
            <div>
              <p className="text-xs font-bold text-[#D8B4FE] tracking-widest uppercase mb-0.5">Your Current Rank</p>
              <h4 className="font-bold text-white text-sm">#142 <span className="text-[#8B7E9F] font-normal">— Top 5%</span></h4>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs font-bold text-[#8B7E9F] mb-0.5">Total XP</p>
            <span className="font-mono font-bold text-white text-base">
              {timeframe === "month" ? "12,450" : "84,200"} <span className="text-[#8B7E9F] text-xs font-sans font-medium">XP</span>
            </span>
          </div>
        </div>
      </div>

    </div>
  );
}
