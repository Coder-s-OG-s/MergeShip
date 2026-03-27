"use client";

import { ArrowLeft, Star, ShieldCheck, Video, CalendarClock, MessageSquareQuote, CheckCircle2, Zap } from "lucide-react";
import Link from "next/link";

export default function MentorshipHubPage() {
  const mentors = [
    { id: 1, name: "David Kim", handle: "@dkim", role: "Core Team @ Next.js", avatar: "DK", tags: ["React", "Performance", "App Router"], price: 5000, available: true, rating: 4.9 },
    { id: 2, name: "Sarah Chen", handle: "@schen", role: "Maintainer @ TailwindCSS", avatar: "SC", tags: ["CSS", "Design Systems", "AST"], price: 3500, available: true, rating: 5.0 },
    { id: 3, name: "James Anderson", handle: "@jando", role: "Creator @ Zustand", avatar: "JA", tags: ["State", "Hooks", "Architecture"], price: 6000, available: false, rating: 4.8 },
    { id: 4, name: "Elena Rostova", handle: "@elena_r", role: "Lead @ Rust Compiler", avatar: "ER", tags: ["Rust", "Systems", "Memory"], price: 8000, available: true, rating: 5.0 },
  ];

  return (
    <div className="max-w-[1200px] mx-auto p-8 font-sans">
      
      {/* Back Navigation */}
      <Link href="/community" className="inline-flex items-center gap-2 text-sm font-bold text-[#8B7E9F] hover:text-white transition-colors mb-8">
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </Link>

      {/* Hero Section */}
      <div className="bg-gradient-to-br from-[#2A2136] to-[#1E1826] border border-[#D8B4FE]/20 rounded-[2.5rem] p-12 mb-12 relative overflow-hidden shadow-2xl">
         <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-[#D8B4FE]/10 rounded-full blur-[100px] pointer-events-none" />
         
         <div className="flex flex-col md:flex-row gap-10 items-center relative z-10">
           <div className="w-24 h-24 rounded-3xl bg-[#15111A] border-4 border-[#D8B4FE]/30 flex items-center justify-center flex-shrink-0 shadow-[0_0_30px_rgba(216,180,254,0.3)]">
             <ShieldCheck className="w-10 h-10 text-[#D8B4FE]" />
           </div>
           
           <div className="flex-1 text-center md:text-left">
             <span className="inline-block px-3 py-1 rounded bg-[#D8B4FE]/10 text-[#D8B4FE] font-bold text-xs tracking-widest mb-4">LEVEL 5 EXCLUSIVE FEATURE</span>
             <h1 className="text-4xl font-display font-bold text-white mb-4">1-on-1 Core Mentorship</h1>
             <p className="text-[#8B7E9F] text-lg max-w-2xl leading-relaxed">
               Spend your hard-earned XP to book 30-minute pair programming sessions with the maintainers of the world's top open-source repositories.
             </p>
           </div>
         </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* Left Col - Mentors */}
        <div className="lg:col-span-2 space-y-6">
          <div className="flex justify-between items-end mb-4">
            <h2 className="text-xl font-bold text-white">Available Maintainers</h2>
            <span className="text-sm font-bold text-[#8B7E9F] bg-[#1E1826] px-3 py-1.5 rounded-lg border border-white/5">Sort: By Availability</span>
          </div>

          <div className="space-y-4">
            {mentors.map(mentor => (
              <div key={mentor.id} className="bg-[#1E1826] border border-white/5 hover:border-[#D8B4FE]/30 rounded-2xl p-6 transition-all group shadow-lg">
                <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
                  
                  <div className="w-16 h-16 rounded-full bg-[#2A2136] border-2 border-[#15111A] flex items-center justify-center text-xl font-bold text-white flex-shrink-0 relative">
                    {mentor.avatar}
                    {mentor.available && <div className="absolute right-0 bottom-0 w-4 h-4 rounded-full bg-emerald-400 border-2 border-[#15111A]" />}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <h3 className="font-bold text-white text-lg">{mentor.name}</h3>
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded bg-white/5">
                        <Star className="w-3 h-3 text-[#FACC15]" fill="#FACC15" />
                        <span className="text-xs font-bold text-white">{mentor.rating}</span>
                      </div>
                    </div>
                    <p className="text-sm text-[#D8B4FE] font-bold mb-3">{mentor.role}</p>
                    
                    <div className="flex flex-wrap gap-2">
                       {mentor.tags.map(tag => (
                         <span key={tag} className="text-[10px] font-bold tracking-wider uppercase px-2 py-1 rounded bg-[#15111A] text-[#8B7E9F] border border-white/5">
                           {tag}
                         </span>
                       ))}
                    </div>
                  </div>

                  <div className="w-full sm:w-auto flex flex-col items-center sm:items-end gap-3 border-t sm:border-t-0 border-white/5 pt-4 sm:pt-0">
                    <div className="flex items-center gap-1.5 text-sm font-bold text-[#FACC15] bg-[#FACC15]/10 px-3 py-1.5 rounded-lg border border-[#FACC15]/20">
                      <Zap className="w-4 h-4" /> {mentor.price} XP
                    </div>
                    <button 
                      disabled={!mentor.available}
                      className={`w-full sm:w-auto px-6 py-2.5 rounded-xl font-bold text-sm transition-all ${
                        mentor.available 
                          ? "bg-white/5 text-white hover:bg-[#D8B4FE] hover:text-[#15111A] border border-white/10" 
                          : "bg-[#15111A] text-[#8B7E9F] cursor-not-allowed border border-white/5"
                      }`}
                    >
                      {mentor.available ? "Book Session" : "Fully Booked"}
                    </button>
                  </div>

                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Col - How it works */}
        <div>
           <div className="bg-[#15111A] border border-white/5 rounded-3xl p-8 sticky top-8 shadow-xl">
             <h3 className="text-lg font-bold text-white mb-6">How Mentorship Works</h3>
             
             <ul className="space-y-6 relative">
               <div className="absolute left-[15px] top-[15px] bottom-[15px] w-0.5 bg-white/5" />
               
               <li className="flex gap-4 relative z-10">
                 <div className="w-8 h-8 rounded-full bg-[#1E1826] border border-white/10 flex items-center justify-center text-[#D8B4FE] flex-shrink-0">1</div>
                 <div>
                   <h4 className="font-bold text-sm text-white mb-1">Earn XP on the Board</h4>
                   <p className="text-xs text-[#8B7E9F] leading-relaxed">Solve standard and hard issues to stockpile your XP. You must be Level 5+.</p>
                 </div>
               </li>
               
               <li className="flex gap-4 relative z-10">
                 <div className="w-8 h-8 rounded-full bg-[#1E1826] border border-white/10 flex items-center justify-center text-[#D8B4FE] flex-shrink-0">2</div>
                 <div>
                   <h4 className="font-bold text-sm text-white mb-1">Book a Maintainer</h4>
                   <p className="text-xs text-[#8B7E9F] leading-relaxed">Spend XP to schedule a 30-minute block directly on their calendar.</p>
                 </div>
               </li>

               <li className="flex gap-4 relative z-10">
                 <div className="w-8 h-8 rounded-full bg-[#1E1826] border border-white/10 flex items-center justify-center text-[#D8B4FE] flex-shrink-0">3</div>
                 <div>
                   <h4 className="font-bold text-sm text-white mb-1">Pair & Merge</h4>
                   <p className="text-xs text-[#8B7E9F] leading-relaxed">Hop on a video call, review complex PR architectures, and get unstuck instantly.</p>
                 </div>
               </li>
             </ul>

             <div className="mt-8 p-4 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
               <MessageSquareQuote className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
               <p className="text-xs text-orange-200 leading-relaxed italic">
                 "A 30-minute session with David saved me 2 weeks of blindly debugging the App Router's cache logic."
               </p>
             </div>
           </div>
        </div>

      </div>
    </div>
  );
}
