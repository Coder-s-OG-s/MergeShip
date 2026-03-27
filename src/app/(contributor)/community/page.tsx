"use client";

import { Users, MessagesSquare, Target, Zap, ChevronRight, Lock, ShieldCheck, Github, Code2, Terminal, Flame, Trophy } from "lucide-react";
import Link from "next/link";

export default function CommunityPage() {
  return (
    <div className="max-w-[1400px] mx-auto p-8 font-sans">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12">
        <div>
          <h1 className="text-3xl font-display font-bold text-white mb-2">Community Guilds</h1>
          <p className="text-[#8B7E9F]">Learn, pair program, and grow with developers at your exact level.</p>
        </div>
        <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-[#D8B4FE] text-[#15111A] hover:bg-white transition-colors shadow-[0_0_20px_rgba(216,180,254,0.3)]">
          <MessagesSquare className="w-4 h-4" /> Open Discord
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Main Content - Left 2 Columns */}
        <div className="lg:col-span-2 space-y-8">
          
          {/* Mentorship Banner (Locked) */}
          <div className="bg-gradient-to-r from-[#1E1826] to-[#2A2136] rounded-3xl p-8 border border-white/5 relative overflow-hidden group shadow-xl">
            <div className="absolute right-0 top-0 w-64 h-64 bg-[#D8B4FE]/5 rounded-bl-[100px] pointer-events-none" />
            <div className="flex items-start gap-6">
              <div className="w-14 h-14 rounded-2xl bg-[#15111A] border-2 border-white/10 flex items-center justify-center flex-shrink-0 relative">
                <Lock className="w-6 h-6 text-[#8B7E9F]" />
                <div className="absolute -top-2 -right-2 w-5 h-5 bg-[#EF4444] rounded-full flex items-center justify-center border-2 border-[#1E1826]">
                  <ShieldCheck className="w-3 h-3 text-white" />
                </div>
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-xl font-bold text-white">1-on-1 Core Mentorship</h2>
                  <span className="text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-[#8B7E9F] tracking-widest hidden sm:inline-block">REQUIRES LEVEL 5</span>
                </div>
                <p className="text-[#8B7E9F] text-[15px] leading-relaxed mb-6 max-w-xl">
                  Gain direct access to maintainers of top 100 open-source repositories for pairing sessions and architecture reviews. You are currently Level 3.
                </p>
                
                <div className="space-y-2 mb-6">
                  <div className="flex justify-between text-xs font-bold">
                    <span className="text-white">Level 3</span>
                    <span className="text-[#8B7E9F]">12,450 / 25,000 XP to Level 5</span>
                  </div>
                  <div className="h-2.5 w-full bg-[#15111A] rounded-full overflow-hidden border border-white/5">
                    <div className="h-full bg-gradient-to-r from-[#D8B4FE] to-[#9333EA] w-[45%] rounded-full relative">
                       <div className="absolute right-0 top-0 bottom-0 w-4 bg-white/20 animate-pulse" />
                    </div>
                  </div>
                </div>

                <Link href="/community/mentorship" className="inline-block">
                  <button className="px-5 py-2 rounded-lg bg-white/5 border border-white/10 text-white font-bold text-xs hover:bg-[#D8B4FE] hover:text-[#15111A] transition-colors">
                    Preview Mentor Hub
                  </button>
                </Link>
              </div>
            </div>
          </div>

          {/* Recommended Guilds */}
          <div>
            <div className="flex items-center justify-between mb-6 mt-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Target className="w-5 h-5 text-[#38BDF8]" /> Recommended Guilds
              </h2>
              <Link href="/community/directory" className="text-xs font-bold text-[#8B7E9F] hover:text-[#D8B4FE] transition-colors flex items-center gap-1">
                View Directory <ChevronRight className="w-3 h-3" />
              </Link>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              
              <Link href="/community/react-performance" className="bg-[#1E1826] border border-white/5 rounded-2xl p-6 hover:border-[#D8B4FE]/30 transition-all cursor-pointer group shadow-lg block">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400">
                    <Code2 className="w-6 h-6" />
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-[#8B7E9F]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 142 ONLINE
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-2 group-hover:text-[#D8B4FE] transition-colors">React Performance</h3>
                <p className="text-[13px] text-[#8B7E9F] mb-6 leading-relaxed">Focusing on concurrent rendering and memoization bugs in major frameworks.</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-blue-500 border-2 border-[#1E1826]" />
                    <div className="w-6 h-6 rounded-full bg-emerald-500 border-2 border-[#1E1826]" />
                    <div className="w-6 h-6 rounded-full bg-purple-500 border-2 border-[#1E1826]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#8B7E9F] ml-2 tracking-wide">YOUR NETWORK</span>
                </div>
              </Link>

               <Link href="/community/rust-systems" className="bg-[#1E1826] border border-white/5 rounded-2xl p-6 hover:border-[#D8B4FE]/30 transition-all cursor-pointer group shadow-lg block">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-orange-500/10 flex items-center justify-center text-orange-400">
                    <Terminal className="w-6 h-6" />
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-white/5 text-[#8B7E9F]">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> 89 ONLINE
                  </span>
                </div>
                <h3 className="font-bold text-white text-base mb-2 group-hover:text-[#D8B4FE] transition-colors">Rust Systems</h3>
                <p className="text-[13px] text-[#8B7E9F] mb-6 leading-relaxed">Tackling memory safety and ownership issues via standard quests and pair programming.</p>
                <div className="flex items-center gap-2">
                  <div className="flex -space-x-2">
                    <div className="w-6 h-6 rounded-full bg-orange-500 border-2 border-[#1E1826]" />
                    <div className="w-6 h-6 rounded-full bg-rose-500 border-2 border-[#1E1826]" />
                  </div>
                  <span className="text-[10px] font-bold text-[#8B7E9F] ml-2 tracking-wide">+12 OTHERS</span>
                </div>
              </Link>

            </div>
          </div>
        </div>

        {/* Right Sidebar */}
        <div className="space-y-6">
          
          {/* Weekly Challenge */}
          <div className="bg-[#1E1826] border border-[#FACC15]/20 rounded-3xl p-6 relative overflow-hidden shadow-xl">
            <div className="absolute -top-10 -right-10 w-32 h-32 bg-[#FACC15]/10 rounded-full blur-[40px] pointer-events-none" />
            
            <div className="flex items-center gap-2 mb-5 relative z-10">
              <Flame className="w-5 h-5 text-[#FACC15]" />
              <h3 className="font-bold text-white">Weekly Guild Challenge</h3>
            </div>
            
            <p className="text-[15px] font-bold text-white mb-2 leading-snug relative z-10">"Squash 3 Easy Dependency Bugs"</p>
            <p className="text-xs text-[#8B7E9F] mb-6 relative z-10">Complete this challenge before Sunday midnight to earn the Pioneer Badge.</p>
            
            <div className="bg-[#15111A] rounded-2xl p-5 border border-white/5 mb-6 relative z-10 shadow-inner">
              <div className="flex justify-between items-end mb-3">
                <span className="text-xs font-bold text-white">Progress</span>
                <span className="text-xs font-bold text-[#FACC15]">1 / 3 Merged</span>
              </div>
              <div className="flex gap-1.5 mb-4">
                <div className="h-2 flex-1 rounded-sm bg-[#FACC15] shadow-[0_0_10px_rgba(250,204,21,0.5)]" />
                <div className="h-2 flex-1 rounded-sm bg-white/5" />
                <div className="h-2 flex-1 rounded-sm bg-white/5" />
              </div>
              <div className="flex items-center justify-between text-[10px] font-bold">
                <span className="text-[#8B7E9F] flex items-center gap-1.5"><Zap className="w-3.5 h-3.5 text-[#D8B4FE]" /> +500 XP</span>
                <span className="text-[#8B7E9F] flex items-center gap-1.5"><Trophy className="w-3.5 h-3.5 text-[#FACC15]" /> Pioneer Badge</span>
              </div>
            </div>

            <button className="w-full py-3.5 rounded-xl font-bold text-sm bg-white/5 text-white hover:bg-white/10 transition-colors border border-white/10 relative z-10">
              Find Matching Issues
            </button>
          </div>

          {/* Quick Stats */}
           <div className="bg-[#15111A] border border-white/5 rounded-3xl p-6 shadow-xl">
            <h3 className="font-bold text-white text-sm mb-5 flex items-center gap-2">
              <Github className="w-4 h-4 text-[#8B7E9F]" /> Your Graph
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-[#8B7E9F] tracking-wide">Followers</span>
                <span className="font-mono font-bold text-white text-sm">42</span>
              </div>
              <div className="flex justify-between items-center bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-[#8B7E9F] tracking-wide">Following</span>
                <span className="font-mono font-bold text-white text-sm">128</span>
              </div>
              <div className="flex justify-between items-center bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <span className="text-xs font-bold text-[#8B7E9F] tracking-wide">Guilds Joined</span>
                <span className="font-mono font-bold text-[#D8B4FE] text-sm">2</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
