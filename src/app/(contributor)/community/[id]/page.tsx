"use client";

import { Users, Video, Clock, MessageSquare, ArrowLeft, Plus, Star, Trophy, UsersRound } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function GuildDetailPage() {
  const { id } = useParams();
  
  const guildName = id === "rust-systems" ? "Rust Systems" : "React Performance";
  const memberCount = id === "rust-systems" ? 89 : 142;
  const isReact = id !== "rust-systems";

  return (
    <div className="max-w-[1400px] mx-auto p-8 font-sans">
      
      {/* Back Navigation */}
      <Link href="/community" className="inline-flex items-center gap-2 text-sm font-bold text-[#8B7E9F] hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Directory
      </Link>

      {/* Guild Header */}
      <div className="bg-[#1E1826] border border-white/5 rounded-3xl p-8 mb-8 relative overflow-hidden shadow-xl">
         <div className="absolute right-0 top-0 w-64 h-64 bg-[#D8B4FE]/10 rounded-full blur-[80px] pointer-events-none" />
         
         <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 relative z-10">
           <div className="flex items-center gap-6">
             <div className={`w-20 h-20 rounded-2xl flex items-center justify-center ${isReact ? "bg-blue-500/10 text-blue-400" : "bg-orange-500/10 text-orange-400"} border border-white/5`}>
                <UsersRound className="w-10 h-10" />
             </div>
             <div>
               <div className="flex items-center gap-3 mb-2">
                 <h1 className="text-3xl font-display font-bold text-white">{guildName}</h1>
                 <span className="flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> {memberCount} ONLINE
                 </span>
               </div>
               <p className="text-[#8B7E9F]">
                 {isReact ? "Focusing on concurrent rendering and memoization bugs in major frameworks." : "Tackling memory safety and ownership issues via standard quests."}
               </p>
             </div>
           </div>
           
           <div className="flex items-center gap-3">
             <button className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold bg-white/5 text-white hover:bg-white/10 transition-colors border border-white/10">
               <MessageSquare className="w-4 h-4" /> Guild Chat
             </button>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Column - Active Sessions & Quests */}
        <div className="lg:col-span-2 space-y-8">
          
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Video className="w-5 h-5 text-[#EF4444]" /> Live Pair Programming
            </h2>
            <button className="text-xs font-bold text-[#D8B4FE] hover:text-white transition-colors flex items-center gap-1">
               <Plus className="w-3 h-3" /> Start Session
            </button>
          </div>
          
          {/* Live Call Widget */}
          <div className="bg-[#1E1826] border border-white/5 rounded-2xl p-6 relative group overflow-hidden cursor-pointer hover:border-red-500/30 transition-all shadow-lg">
            <div className="absolute top-0 left-0 w-1 h-full bg-red-500" />
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-full bg-[#2A2136] border-2 border-[#15111A] flex items-center justify-center text-white font-bold shadow-lg">
                  SC
                </div>
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-[10px] font-bold px-1.5 rounded bg-red-500/20 text-red-400 tracking-widest animate-pulse">LIVE NOW</span>
                    <span className="text-xs font-bold text-[#8B7E9F]">Sarah Chen</span>
                  </div>
                  <h3 className="font-bold text-white text-sm">Debugging Transition Overlaps</h3>
                  <p className="text-xs text-[#8B7E9F] mt-1">Working on issue #14201 in {isReact ? "React DOM" : "Rust Compiler"}.</p>
                </div>
              </div>
              <button className="px-5 py-2.5 rounded-xl bg-red-500/10 text-red-400 border border-red-500/30 font-bold text-xs shadow-[0_0_15px_rgba(239,68,68,0.2)] hover:bg-red-500 hover:text-white transition-all">
                Join Call
              </button>
            </div>
          </div>

          <h2 className="text-lg font-bold text-white flex items-center gap-2 mt-8 mb-4">
            <Trophy className="w-5 h-5 text-[#FACC15]" /> Guild Quests
          </h2>

          <div className="space-y-3">
             {[1, 2].map((i) => (
                <div key={i} className="bg-[#15111A] border border-white/5 rounded-2xl p-5 hover:bg-[#1E1826] transition-colors cursor-pointer shadow-lg">
                  <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-2">
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-400">MEDIUM</span>
                      <span className="text-xs text-[#8B7E9F]">{isReact ? "facebook/react" : "rust-lang/rust"}</span>
                    </div>
                    <span className="text-xs font-bold text-[#FACC15] flex items-center gap-1.5"><Star className="w-3.5 h-3.5" /> +150 XP</span>
                  </div>
                  <h4 className="font-bold text-white text-[15px] mb-1">{isReact ? "Fix race condition in useEffect cleanup" : "Implement optimized borrow checker pass"}</h4>
                  <div className="mt-4 flex items-center justify-between text-[#8B7E9F] text-xs">
                     <span className="flex items-center gap-1.5 font-bold"><Clock className="w-3.5 h-3.5" /> Est: 3-6 hours</span>
                     <span className="text-[10px] font-bold tracking-widest uppercase flex items-center gap-1.5">
                       <div className="flex -space-x-1.5 mr-1">
                          <div className="w-4 h-4 rounded-full border border-[#15111A] bg-blue-500" />
                          <div className="w-4 h-4 rounded-full border border-[#15111A] bg-emerald-500" />
                       </div>
                       3 members investigating
                     </span>
                  </div>
                </div>
             ))}
          </div>

        </div>

        {/* Right Column - Top Contributors & Mentors */}
        <div className="space-y-6">
          
          <div className="bg-[#15111A] border border-white/5 rounded-3xl p-6 shadow-xl">
            <h3 className="font-bold text-white text-sm mb-5">Top Guild Contributors Today</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#FACC15]">1</span>
                  <div className="w-8 h-8 rounded-full bg-[#38BDF8] text-[#15111A] flex items-center justify-center text-xs font-bold shadow-md">AR</div>
                  <span className="text-sm font-bold text-white">Alex Rivera</span>
                </div>
                <span className="text-xs font-bold text-[#8B7E9F]">4 PRs</span>
              </div>
              <div className="flex items-center justify-between bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                   <span className="text-xs font-bold text-[#E2E8F0]">2</span>
                  <div className="w-8 h-8 rounded-full bg-[#D8B4FE] text-[#15111A] flex items-center justify-center text-xs font-bold shadow-md">EW</div>
                  <span className="text-sm font-bold text-white">Emma W.</span>
                </div>
                <span className="text-xs font-bold text-[#8B7E9F]">2 PRs</span>
              </div>
              <div className="flex items-center justify-between bg-[#1E1826] p-3 rounded-xl border border-white/5">
                <div className="flex items-center gap-3">
                   <span className="text-xs font-bold text-[#D4A373]">3</span>
                  <div className="w-8 h-8 rounded-full bg-emerald-400 text-[#15111A] flex items-center justify-center text-xs font-bold shadow-md">SC</div>
                  <span className="text-sm font-bold text-white">Sarah C.</span>
                </div>
                <span className="text-xs font-bold text-[#8B7E9F]">1 PR</span>
              </div>
            </div>
            
            <button className="w-full mt-5 py-2.5 rounded-lg border border-white/5 bg-white/5 text-xs font-bold text-white hover:bg-white/10 transition-colors">
              View Full Guild Rankings
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
