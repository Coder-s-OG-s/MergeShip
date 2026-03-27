"use client";

import { Rocket, Medal, Star, Flame, Award, CheckCircle, Target, Bug, Settings, MessageSquare, ChevronRight, Lock, ArrowUp } from "lucide-react";

export default function DashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto p-8 font-sans">
      
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-1.5">Welcome back, Captain</h1>
          <p className="text-[#8B7E9F]">You're 850 XP away from reaching Level 4.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 rounded-lg font-bold text-sm transition-transform hover:scale-105"
          style={{ background: "#D8B4FE", color: "#15111A" }}>
          <Rocket className="w-4 h-4" />
          Get Today's Issues
        </button>
      </div>

      {/* 4 Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
        
        {/* Card 1: Level */}
        <div className="rounded-2xl p-6 border border-white/5 relative overflow-hidden group" style={{ background: "#1E1826" }}>
          <div className="absolute top-6 right-6 text-[#D8B4FE]"><Medal className="w-5 h-5" /></div>
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color: "#8B7E9F" }}>Current Level</p>
          <h2 className="text-2xl font-bold text-white mb-6">L3 Intermediate</h2>
          <div className="flex items-center gap-3">
            <div className="flex-1 h-1.5 rounded-full bg-white/5 relative overflow-hidden">
              <div className="absolute top-0 left-0 h-full rounded-full w-[65%]" style={{ background: "linear-gradient(90deg, #9333EA, #D8B4FE)" }} />
            </div>
            <span className="text-[10px] font-bold" style={{ color: "#D8B4FE" }}>65%</span>
          </div>
        </div>

        {/* Card 2: Total XP */}
        <div className="rounded-2xl p-6 border border-white/5 relative group" style={{ background: "#1E1826" }}>
          <div className="absolute top-6 right-6 text-[#D8B4FE]"><Star className="w-5 h-5" /></div>
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color: "#8B7E9F" }}>Total XP</p>
          <h2 className="text-3xl font-bold text-white mb-2">12,450</h2>
          <p className="text-xs flex items-center gap-1 text-[#4ADE80] font-medium">
            <TrendingUpIcon className="w-3 h-3" /> +450 this week
          </p>
        </div>

        {/* Card 3: Streak */}
        <div className="rounded-2xl p-6 border border-white/5 relative group" style={{ background: "#1E1826" }}>
          <div className="absolute top-6 right-6 text-[#F97316]"><Flame className="w-5 h-5" /></div>
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color: "#8B7E9F" }}>Work Streak</p>
          <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-2">14 Days <span className="text-xl">🔥</span></h2>
          <p className="text-xs" style={{ color: "#8B7E9F" }}>Personal record: 22 days</p>
        </div>

        {/* Card 4: Badges */}
        <div className="rounded-2xl p-6 border border-white/5 relative group" style={{ background: "#1E1826" }}>
          <div className="absolute top-6 right-6 text-[#D8B4FE]"><Award className="w-5 h-5" /></div>
          <p className="text-xs font-bold tracking-wider mb-2" style={{ color: "#8B7E9F" }}>Badges Earned</p>
          <h2 className="text-3xl font-bold text-white mb-2">28</h2>
          <p className="text-xs" style={{ color: "#8B7E9F" }}>Top 5% of contributors</p>
        </div>
      </div>

      {/* Main Grid: Left side (Issues + Heatmap) + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column span 2 */}
        <div className="lg:col-span-2 flex flex-col gap-8">
          
          {/* Issue Columns */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            
            {/* Column 1: Easy */}
            <div>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-2 h-2 rounded-full bg-[#4ADE80]" />
                <h3 className="text-xs font-bold tracking-widest text-white">EASY PICKINGS</h3>
              </div>
              <div className="rounded-2xl p-5 border border-white/5 hover:border-[#D8B4FE]/30 transition-colors cursor-pointer" style={{ background: "#1E1826" }}>
                <div className="flex items-center gap-2 mb-4 text-[#8B7E9F] text-xs font-medium">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 text-[#38BDF8]">
                    <div className="w-2 h-2 rounded bg-current" />
                  </div>
                  <span>facebook / react</span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  <h4 className="font-bold text-white text-base leading-snug">Update documentation for useActionState hook</h4>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 w-fit border border-blue-500/20">
                    <span className="text-[10px] font-bold text-blue-400 font-sans tracking-wide">⭐ You starred this repository 3 months ago</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(74,222,128,0.1)", color: "#4ADE80" }}>EASY</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">Docs</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">React</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
                  <span className="text-[#8B7E9F] flex items-center gap-1.5"><ClockIcon className="w-3.5 h-3.5" /> 20m</span>
                  <span className="text-[#D8B4FE] flex items-center gap-1.5"><StarIcon className="w-3.5 h-3.5" /> 50 XP</span>
                </div>
              </div>
            </div>

            {/* Column 2: Medium */}
            <div>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-2 h-2 rounded-full bg-[#FACC15]" />
                <h3 className="text-xs font-bold tracking-widest text-white">STANDARD QUESTS</h3>
              </div>
              <div className="rounded-2xl p-5 border border-white/5 hover:border-[#D8B4FE]/30 transition-colors cursor-pointer" style={{ background: "#1E1826" }}>
                <div className="flex items-center gap-2 mb-4 text-[#8B7E9F] text-xs font-medium">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 text-white">
                    <div className="w-0 h-0 border-[4px] border-transparent border-b-current translate-y-[-2px]" />
                  </div>
                  <span>vercel / next.js</span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  <h4 className="font-bold text-white text-base leading-snug">Refactor internal route cache handling</h4>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 w-fit border border-emerald-500/20">
                    <span className="text-[10px] font-bold text-emerald-400 font-sans tracking-wide">🔗 You have 4 past contributions here</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(250,204,21,0.1)", color: "#FACC15" }}>MEDIUM</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">Caching</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">TS</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
                  <span className="text-[#8B7E9F] flex items-center gap-1.5"><ClockIcon className="w-3.5 h-3.5" /> 45m</span>
                  <span className="text-[#D8B4FE] flex items-center gap-1.5"><StarIcon className="w-3.5 h-3.5" /> 120 XP</span>
                </div>
              </div>
            </div>

            {/* Column 3: Hard */}
            <div>
              <div className="flex items-center gap-2 mb-4 px-1">
                <div className="w-2 h-2 rounded-full bg-[#EF4444]" />
                <h3 className="text-xs font-bold tracking-widest text-white">ELITE CHALLENGES</h3>
              </div>
              <div className="rounded-2xl p-5 border border-white/5 hover:border-[#D8B4FE]/30 transition-colors cursor-pointer" style={{ background: "#1E1826" }}>
                <div className="flex items-center gap-2 mb-4 text-[#8B7E9F] text-xs font-medium">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5 text-[#38BDF8]">
                    <span className="text-[10px] font-bold text-current">~~</span>
                  </div>
                  <span>tailwind / engine</span>
                </div>
                <div className="flex flex-col gap-2 mb-4">
                  <h4 className="font-bold text-white text-base leading-snug">Implement Just-in-Time variant resolution engine</h4>
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 w-fit border border-purple-500/20">
                    <span className="text-[10px] font-bold text-purple-400 font-sans tracking-wide">💬 You commented on an issue here last week</span>
                  </div>
                </div>
                <div className="flex flex-wrap gap-2 mb-6">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded" style={{ background: "rgba(239,68,68,0.1)", color: "#EF4444" }}>HARD</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">Rust</span>
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">Parser</span>
                </div>
                <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
                  <span className="text-[#8B7E9F] flex items-center gap-1.5"><ClockIcon className="w-3.5 h-3.5" /> 120m+</span>
                  <span className="text-[#D8B4FE] flex items-center gap-1.5"><StarIcon className="w-3.5 h-3.5" /> 350 XP</span>
                </div>
              </div>
            </div>

          </div>

          {/* Heatmap */}
          <div className="rounded-2xl p-6 border border-white/5" style={{ background: "#1E1826" }}>
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-base font-bold text-white">Contribution Heatmap</h2>
              <div className="flex items-center gap-1.5 text-[10px] font-bold" style={{ color: "#8B7E9F" }}>
                <span>LESS</span>
                <div className="flex gap-1">
                  {["#2A2136", "#50307B", "#7C3AED", "#9333EA", "#D8B4FE"].map(c => (
                    <div key={c} className="w-3 h-3 rounded-sm" style={{ background: c }} />
                  ))}
                </div>
                <span>MORE</span>
              </div>
            </div>
            
            {/* Fake Heatmap Grid */}
            <div className="flex gap-1 overflow-hidden" style={{ height: "115px" }}>
              {/* Day Labels */}
              <div className="flex flex-col justify-between text-[10px] text-[#8B7E9F] pt-6 pb-2 mr-2">
                <span>MON</span>
                <span>WED</span>
                <span>FRI</span>
              </div>
              <div className="flex-1 overflow-hidden">
                <div className="flex gap-1.5 mb-1.5 text-[10px] text-[#8B7E9F] pl-1">
                  <span className="w-10">Jan</span><span className="w-10">Feb</span><span className="w-10">Mar</span>
                  <span className="w-10">Apr</span><span className="w-10">May</span><span className="w-10">Jun</span>
                  <span className="w-10">Jul</span><span className="w-10">Aug</span><span className="w-10">Sep</span>
                  <span className="w-10">Oct</span><span className="w-10">Nov</span><span className="w-10">Dec</span>
                </div>
                <div className="flex gap-1 h-[75px] pl-1">
                  {/* Generating dummy columns */}
                  {Array.from({ length: 45 }).map((_, col) => (
                    <div key={col} className="flex flex-col gap-1">
                      {Array.from({ length: 5 }).map((_, row) => {
                        const colors = ["#2A2136", "#2A2136", "#2A2136", "#50307B", "#7C3AED", "#9333EA", "#D8B4FE"];
                        const c = colors[Math.floor(Math.random() * colors.length)];
                        return <div key={row} className="w-3 h-3 rounded-sm" style={{ background: c }} />;
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </div>
            
            <p className="text-center text-xs mt-4" style={{ color: "#8B7E9F" }}>Your last 365 days of merge activity</p>
          </div>

        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-5">
          
          {/* Recent Badges */}
          <div className="rounded-2xl p-6 border border-white/5" style={{ background: "#1E1826" }}>
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-base font-bold text-white">Recent Badges</h2>
              <button className="text-xs font-bold text-[#D8B4FE] hover:underline">View All</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#2A2136] border border-[#D8B4FE]/20">
                <CheckCircle className="w-6 h-6 text-[#4ADE80] mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center">PIONEER</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#2A2136] border border-[#D8B4FE]/20">
                <Flame className="w-6 h-6 text-[#F97316] mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center">HOT</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl bg-[#2A2136] border border-[#D8B4FE]/20">
                <Bug className="w-6 h-6 text-[#D8B4FE] mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center leading-none">EXTERMINATOR</span>
              </div>
              
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 opacity-40">
                <div className="w-6 h-6 rounded bg-[#2A2136] mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center">LOCKED</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 opacity-40">
                <Award className="w-6 h-6 text-gray-500 mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center">LOCKED</span>
              </div>
              <div className="flex flex-col items-center justify-center p-3 rounded-xl border border-white/5 opacity-40">
                <ShieldIcon className="w-6 h-6 text-gray-500 mb-2" />
                <span className="text-[9px] font-bold text-[#8B7E9F] tracking-widest text-center">LOCKED</span>
              </div>
            </div>
          </div>

          {/* Community */}
          <div className="rounded-2xl p-6 border border-white/5" style={{ background: "#1E1826" }}>
            <h2 className="text-base font-bold text-white mb-5">Community</h2>
            <div className="space-y-4">
              <div className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#3B82F6] flex items-center justify-center text-white"><MessageSquare className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white">Join Discord</h4>
                  <p className="text-[#8B7E9F] text-xs">12k members online</p>
                </div>
              </div>
              <div className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#9333EA] flex items-center justify-center text-white"><Settings className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white">Ship Logs</h4>
                  <p className="text-[#8B7E9F] text-xs">Weekly dev updates</p>
                </div>
              </div>
              <div className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2 -m-2 rounded-xl transition-colors">
                <div className="w-10 h-10 rounded-full bg-[#10B981] flex items-center justify-center text-white"><Target className="w-5 h-5" /></div>
                <div>
                  <h4 className="text-sm font-bold text-white">Mentorship</h4>
                  <p className="text-[#8B7E9F] text-xs">Get help from L5+ devs</p>
                </div>
              </div>
            </div>
          </div>

          {/* Upgrade to Pro */}
          <div className="rounded-2xl p-6 border border-white/5 relative overflow-hidden" style={{ background: "#1E1826" }}>
            {/* Subtle glow background */}
            <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#D8B4FE]/10 rounded-full blur-2xl" />
            <h2 className="text-base font-bold text-white mb-2">Upgrade to Pro</h2>
            <p className="text-xs leading-relaxed mb-5" style={{ color: "#8B7E9F" }}>
              Unlock advanced metrics, priority PR reviews, and exclusive badges.
            </p>
            <button className="w-full py-3 rounded-lg text-sm font-bold transition-transform hover:scale-105"
              style={{ background: "#D8B4FE", color: "#15111A" }}>
              Get Pro
            </button>
          </div>

        </div>

      </div>

      {/* Basic Footer inside main wrapper */}
      <div className="mt-16 py-6 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-xs" style={{ color: "#8B7E9F" }}>
        <div className="flex items-center gap-2 mb-4 md:mb-0">
          <ArrowUp className="w-3 h-3 text-[#D8B4FE]" />
          <span>© 2024 MergeShip. Build together, level up faster.</span>
        </div>
        <div className="flex items-center gap-6 font-bold tracking-widest">
          <a href="#" className="hover:text-white transition-colors">PRIVACY</a>
          <a href="#" className="hover:text-white transition-colors">TERMS</a>
          <a href="#" className="hover:text-white transition-colors">API DOCS</a>
          <a href="#" className="hover:text-white transition-colors">STATUS</a>
        </div>
      </div>
    </div>
  );
}

// Simple internal icon components for ones lucide doesn't perfectly match
function TrendingUpIcon(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/></svg>;
}
function ClockIcon(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>;
}
function StarIcon(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="currentColor"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>;
}
function ShieldIcon(props: any) {
  return <svg {...props} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>;
}
