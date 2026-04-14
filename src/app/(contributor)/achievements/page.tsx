"use client";
import { useEffect, useState, useRef } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { Lock, Trophy, Target, Award, Star } from "lucide-react";
import { account } from "@/lib/appwrite";
import { getAchievements, claimBadge } from "../dashboard/actions";
import { motion, AnimatePresence } from "framer-motion";
import { clsx } from "clsx";
import confetti from "canvas-confetti";

function ClaimModal({ badge, onClose }: { badge: any; onClose: () => void }) {
  useEffect(() => {
    confetti({
      particleCount: 150,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#7C3AED', '#B78AF7', '#60A5FA']
    });
  }, []);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-[#060611]/90 backdrop-blur-xl"
    >
      <motion.div 
        initial={{ scale: 0.9, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        className="w-full max-w-lg glass-card rounded-[40px] p-12 text-center relative overflow-hidden bg-gradient-to-b from-white/10 to-transparent border-white/10 border"
      >
        {/* Cinematic Background Elements */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-purple-600/20 rounded-full blur-[100px] -z-10" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-48 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent rotate-45" />

        <div className="relative mb-10">
          <motion.div
            initial={{ rotate: -15, scale: 0.5 }}
            animate={{ rotate: 0, scale: 1 }}
            transition={{ type: "spring", damping: 12 }}
            className="w-40 h-40 rounded-full mx-auto flex items-center justify-center text-7xl relative"
            style={{
              background: badge.rarity === "Legendary" ? "linear-gradient(135deg, #FACC15, #DC2626)"
                        : badge.rarity === "Epic" ? "linear-gradient(135deg, #C084FC, #7C3AED)"
                        : "linear-gradient(135deg, #60A5FA, #2563EB)"
            }}
          >
            <div className="absolute inset-2 rounded-full bg-[#0D0D1A] flex items-center justify-center border-2 border-white/20">
              {badge.emoji}
            </div>
          </motion.div>
          
          <motion.div 
            initial={{ opacity: 0, scale: 0 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.3 }}
            className="absolute -bottom-2 -right-2 bg-green-500 text-white p-2 rounded-full shadow-lg"
          >
            <Trophy className="w-5 h-5" />
          </motion.div>
        </div>

        <motion.h2 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="text-4xl font-display font-black text-white mb-2"
        >
          Congratulations!
        </motion.h2>
        <motion.p 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="text-[#A78BFA] font-bold text-lg mb-8 uppercase tracking-widest"
        >
          {badge.name} Collected
        </motion.p>

        <motion.div
           initial={{ opacity: 0 }}
           animate={{ opacity: 1 }}
           transition={{ delay: 0.7 }}
        >
          <button
            onClick={onClose}
            className="w-full py-4 rounded-2xl bg-white text-black font-black uppercase tracking-widest hover:bg-gray-200 transition-colors shadow-[0_0_20px_rgba(255,255,255,0.3)]"
          >
            Share Achievement
          </button>
          <button
            onClick={onClose}
            className="w-full py-4 mt-3 rounded-2xl bg-transparent text-white/60 font-black uppercase tracking-widest hover:text-white transition-colors"
          >
            Go Back
          </button>
        </motion.div>
      </motion.div>
    </motion.div>
  );
}

export default function AchievementsPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [claimingBadge, setClaimingBadge] = useState<any>(null);
  const [userHandle, setUserHandle] = useState("");
  const fetchCount = useRef(0);

  const loadData = async (forceSync = false) => {
    const currentFetchId = ++fetchCount.current;
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

      setUserHandle(handle);
      const res = await getAchievements(handle, token, forceSync);
      
      // Only update if this is the latest requested fetch
      if (currentFetchId === fetchCount.current && res.success) {
        setData(res);
      }
    } catch (e) {
      console.error("Achievements init failed", e);
    } finally {
      if (currentFetchId === fetchCount.current) {
        setLoading(false);
      }
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleClaim = async (badge: any) => {
    // Optimistic Update
    setData((prev: any) => ({
      ...prev,
      badges: prev.badges.map((b: any) => b.id === badge.id ? { ...b, claimed: true } : b)
    }));
    
    setClaimingBadge(badge);
    await claimBadge(userHandle, badge.id);
  };

  const handleCloseClaim = () => {
    setClaimingBadge(null);
    loadData(true); // refresh with force
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060611] flex items-center justify-center">
        <div className="w-12 h-12 border-4 border-[#7C3AED] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  const { achievements, badges, summary } = data || { achievements: [], badges: [], summary: { unlocked: 0, total: 0, earnedXP: 0, badgesEarned: 0, badgesToClaim: 0 } };
  const unlocked = achievements.filter((a: any) => a.unlocked);
  const locked = achievements.filter((a: any) => !a.unlocked);

  return (
    <div className="min-h-screen pb-20" style={{ background: "#060611" }}>
      <Topbar title="Achievements" subtitle="Your open source trophy room" />

      <AnimatePresence>
        {claimingBadge && <ClaimModal badge={claimingBadge} onClose={handleCloseClaim} />}
      </AnimatePresence>

      <div className="p-12 max-w-[1400px] mx-auto space-y-16">
        
        {/* Summary Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="glass-card rounded-2xl p-6 border-white/5 bg-white/5">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center text-purple-400">
                   <Trophy className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#606080] mb-1">Unlocked</p>
                   <p className="text-3xl stat-number text-white">{summary.unlocked}</p>
                </div>
             </div>
          </div>
          <div className="glass-card rounded-2xl p-6 border-white/5 bg-white/5">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center text-blue-400">
                   <Target className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#606080] mb-1">Remaining</p>
                   <p className="text-3xl stat-number text-white">{summary.total - summary.unlocked}</p>
                </div>
             </div>
          </div>
          <div className="glass-card rounded-2xl p-6 border-white/5 bg-white/5">
             <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                   <Award className="w-6 h-6" />
                </div>
                <div>
                   <p className="text-[10px] font-black uppercase tracking-widest text-[#606080] mb-1">Badges Earned</p>
                   <p className="text-3xl stat-number text-white">{summary.badgesEarned}</p>
                </div>
             </div>
          </div>
          <div className="glass-card rounded-2xl p-6 border-white/5 bg-white/5 flex flex-col justify-center">
             <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#606080] mb-3">
                <span>Overall Mastery</span>
                <span>{Math.round((summary.unlocked / (summary.total || 1)) * 100)}%</span>
             </div>
             <div className="h-2 rounded-full bg-white/5 overflow-hidden">
                <motion.div 
                   initial={{ width: 0 }}
                   animate={{ width: `${(summary.unlocked / (summary.total || 1)) * 100}%` }}
                   className="h-full bg-gradient-to-r from-[#7C3AED] to-[#B78AF7]"
                />
             </div>
          </div>
        </div>

        {/* Action Banner for pending claims */}
        {summary.badgesToClaim > 0 && (
          <motion.div 
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             className="p-1 px-8 rounded-full bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-between"
          >
             <div className="flex items-center gap-4 py-3">
                <div className="w-8 h-8 rounded-full bg-yellow-500/20 flex items-center justify-center text-yellow-500">
                   <Star className="w-4 h-4 fill-yellow-500" />
                </div>
                <p className="text-xs font-bold text-white uppercase tracking-widest">
                  You have <span className="text-yellow-500">{summary.badgesToClaim}</span> new badges waiting to be claimed!
                </p>
             </div>
          </motion.div>
        )}

        {/* Badge Collection Section */}
        <section>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] flex items-center gap-3">
              <span className="w-8 h-px bg-white/10" />
              My Badge Collection
            </h2>
            <div className="text-[10px] font-bold text-[#606080] uppercase tracking-widest">
              Total Badges: {badges.reduce((acc: number, b: any) => acc + (b.earned ? b.count : 0), 0)}
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-6">
            {badges.map((badge: any) => (
              <motion.div
                key={badge.id}
                whileHover={{ y: -5 }}
                className={clsx(
                  "relative aspect-square rounded-3xl p-1 flex flex-col items-center justify-center gap-3 transition-all duration-500 overflow-hidden",
                  badge.earned 
                    ? "bg-gradient-to-br from-white/10 to-transparent border-white/10 border shadow-2xl" 
                    : "bg-white/[0.02] border-white/5 border opacity-30 grayscale"
                )}
              >
                {/* Claim Overlay */}
                {badge.earned && !badge.claimed && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="absolute inset-0 z-20 bg-purple-900/40 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 p-4 text-center border-2 border-purple-500/50 rounded-3xl"
                   >
                     <div className="bg-[#0D0D1A] px-3 py-1 rounded-full mb-1">
                       <p className="text-[8px] font-black text-[#A78BFA] uppercase tracking-widest animate-pulse">New Milestone!</p>
                     </div>
                     <button
                       onClick={() => handleClaim(badge)}
                       className="px-5 py-2.5 bg-gradient-to-r from-purple-500 to-indigo-600 text-white text-[10px] font-black rounded-xl uppercase tracking-widest hover:scale-105 transition-all shadow-[0_0_15px_rgba(124,58,237,0.4)]"
                     >
                       Claim Badge
                     </button>
                  </motion.div>
                )}

                <div className="absolute top-3 right-3 flex items-center gap-1">
                   {badge.earned && badge.claimed && (
                      <div className="w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_8px_rgba(74,222,128,0.5)]" />
                   )}
                </div>

                <div className={clsx(
                  "w-20 h-20 rounded-full flex items-center justify-center text-4xl mb-1 relative z-10",
                  badge.earned && badge.claimed ? "badge-glow" : ""
                )}
                style={{
                   background: badge.earned 
                    ? badge.rarity === "Legendary" ? "linear-gradient(135deg, #FACC15, #DC2626)"
                    : badge.rarity === "Epic" ? "linear-gradient(135deg, #C084FC, #7C3AED)"
                    : badge.rarity === "Rare" ? "linear-gradient(135deg, #60A5FA, #2563EB)"
                    : "linear-gradient(135deg, #94A3B8, #475569)"
                    : "rgba(255,255,255,0.05)"
                }}>
                  <div className="absolute inset-1 rounded-full bg-[#0D0D1A] flex items-center justify-center border border-white/10 overflow-hidden">
                    <span className="relative z-10">{badge.emoji}</span>
                    {badge.earned && (
                       <div className="absolute inset-0 bg-gradient-to-t from-white/10 to-transparent pointer-events-none" />
                    )}
                  </div>
                </div>

                <div className="text-center px-2">
                  <p className={clsx("text-[10px] font-black uppercase tracking-widest mb-1", badge.earned ? "text-white" : "text-[#606080]")}>
                    {badge.name}
                  </p>
                  {badge.earned && badge.count > 1 && (
                    <span className="text-[9px] font-black bg-white/10 text-white/60 px-2 py-0.5 rounded-full border border-white/5">
                      x{badge.count}
                    </span>
                  )}
                </div>

                {badge.earned && badge.claimed && (
                   <div className="absolute -bottom-2 px-2 py-0.5 rounded-full bg-[#060611] border border-white/10 text-[8px] font-bold text-[#A78BFA] uppercase tracking-tighter">
                      {badge.rarity}
                   </div>
                )}
              </motion.div>
            ))}
          </div>
        </section>

        {/* Unlocked Section */}
        <section>
          <h2 className="text-sm font-black text-white uppercase tracking-[0.2em] mb-8 flex items-center gap-3">
            <span className="w-8 h-px bg-white/10" />
            Milestone Tasks
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
             <AnimatePresence>
               {unlocked.map((a: any) => (
                 <motion.div
                   key={a.id}
                   initial={{ opacity: 0, scale: 0.9 }}
                   animate={{ opacity: 1, scale: 1 }}
                   className="glass-card rounded-2xl p-6 bg-gradient-to-br from-[#1A1A2E] to-[#0D0D1A] border-purple-500/20 border"
                 >
                   <div className="text-4xl mb-4">{a.emoji}</div>
                   <h3 className="text-lg font-bold text-white mb-2">{a.title}</h3>
                   <p className="text-xs text-[#A0A0C0] font-medium leading-relaxed mb-6">{a.description}</p>
                   <div className="flex items-center justify-between">
                     <span className="text-[10px] font-black uppercase tracking-[0.1em] text-[#606080]">Earned 100%</span>
                     <div className="px-3 py-1 rounded-full text-[10px] font-black bg-purple-500/20 text-purple-400 border border-purple-500/30">
                       +{a.xpReward} XP
                     </div>
                   </div>
                 </motion.div>
               ))}
             </AnimatePresence>
          </div>
        </section>

        {/* Locked / In Progress Section */}
        <section>
          <h2 className="text-sm font-black text-[#606080] uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
            <span className="w-8 h-px bg-white/10" />
            In Progress
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
             {locked.map((a: any) => (
               <div
                 key={a.id}
                 className="glass-card rounded-2xl p-6 bg-white/[0.02] border-white/5 border opacity-70 grayscale-[0.5]"
               >
                 <div className="text-4xl mb-4 opacity-40">{a.emoji}</div>
                 <h3 className="text-lg font-bold text-white/50 mb-2">{a.title}</h3>
                 <p className="text-xs text-[#606080] font-medium leading-relaxed mb-6">{a.description}</p>
                 
                 <div className="space-y-3">
                   <div className="flex justify-between text-[10px] font-black uppercase tracking-widest text-[#606080]">
                      <span>Progress</span>
                      <span>{a.progress} / {a.target}</span>
                   </div>
                   <div className="h-1.5 rounded-full bg-white/5 overflow-hidden">
                      <div 
                         className="h-full bg-white/20"
                         style={{ width: `${Math.min((a.progress / a.target) * 100, 100)}%` }}
                      />
                   </div>
                   <p className="text-[10px] font-bold text-[#404060] text-center pt-2">
                      REWARD: +{a.xpReward} XP
                   </p>
                 </div>
               </div>
             ))}
          </div>
        </section>

      </div>
    </div>
  );
}

