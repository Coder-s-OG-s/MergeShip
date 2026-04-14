"use client";
import { CheckCircle, Flame, Bug, Award, Shield, MessageSquare, Settings, Target } from "lucide-react";
import { motion } from "framer-motion";
import { account } from "@/lib/appwrite";
import { getAchievements } from "@/app/(contributor)/dashboard/actions";
import { useEffect, useState } from "react";
import Link from "next/link";

function Badge({ icon: Icon, emoji, color, label, isLocked, rarity }: any) {
  const getGradient = () => {
    if (isLocked) return "bg-white/[0.03]";
    if (rarity === "Legendary") return "linear-gradient(135deg, #FACC15, #DC2626)";
    if (rarity === "Epic") return "linear-gradient(135deg, #C084FC, #7C3AED)";
    if (rarity === "Rare") return "linear-gradient(135deg, #60A5FA, #2563EB)";
    return "linear-gradient(135deg, #94A3B8, #475569)";
  };

  return (
    <motion.div
      whileHover={!isLocked ? { y: -2, scale: 1.02 } : {}}
      className={`flex flex-col items-center justify-center p-2 rounded-xl transition-all duration-300 relative overflow-hidden ${
        isLocked ? "border border-white/5 opacity-40 grayscale" : "border border-[#D8B4FE]/30 shadow-[0_0_15px_rgba(124,58,237,0.1)]"
      }`}
      style={{ background: "rgba(13,13,26,0.5)" }}
    >
      <div 
        className={`w-10 h-10 rounded-full flex items-center justify-center text-xl mb-1.5 p-0.5`}
        style={{ 
          background: getGradient(),
          boxShadow: !isLocked ? "0 0 10px rgba(0,0,0,0.3)" : "none"
        }}
      >
        <div className="w-full h-full rounded-full bg-[#0D0D1A] flex items-center justify-center border border-white/10">
           {emoji ? emoji : <Icon className="w-5 h-5" style={{ color: !isLocked ? color : "#8B7E9F" }} />}
        </div>
      </div>
      <span className="text-[7px] font-black tracking-widest text-center leading-tight text-white uppercase truncate w-full px-1">
        {label}
      </span>
      {!isLocked && (
         <div className="absolute top-1 right-1 w-1 h-1 rounded-full bg-green-400 shadow-[0_0_5px_#4ADE80]" />
      )}
    </motion.div>
  );
}

export function BadgeWidget() {
  const [badges, setBadges] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBadges = async () => {
      try {
        const session = await account.get();
        let handle = session.name.replace(/\s+/g, '-').toLowerCase();
        if (session.name.toLowerCase().includes("ayush patel")) {
           handle = "ayush-patel-56";
        }
        
        const res = await getAchievements(handle);
        if (res.success) {
          // Sort earned badges to the front
          const sorted = [...res.badges].sort((a, b) => (b.earned ? 1 : 0) - (a.earned ? 1 : 0));
          setBadges(sorted);
        }
      } catch (e) {
        console.error("Failed to load badges for widget", e);
      } finally {
        setLoading(false);
      }
    };
    fetchBadges();
  }, []);

  const displayBadges = badges.length > 0 ? badges.slice(0, 6) : [
    { name: "PIONEER", icon: CheckCircle, color: "#4ADE80", earned: false },
    { name: "HOT", icon: Flame, color: "#F97316", earned: false },
    { name: "EXTERMINATOR", icon: Bug, color: "#D8B4FE", earned: false },
    { name: "LOCKED", icon: Award, color: "#8B7E9F", earned: false },
    { name: "LOCKED", icon: Shield, color: "#8B7E9F", earned: false },
    { name: "LOCKED", icon: Award, color: "#8B7E9F", earned: false },
  ];

  return (
    <div className="rounded-2xl p-6 border border-white/5 bg-[#1E1826]/80 backdrop-blur-sm shadow-xl relative overflow-hidden group">
      <div className="absolute top-0 right-0 w-32 h-32 bg-purple-600/5 rounded-full blur-3xl -z-10" />
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-[10px] font-black text-white uppercase tracking-[0.2em] flex items-center gap-2">
           <span className="w-4 h-px bg-[#D8B4FE]/30" />
           Recent Badges
        </h2>
        <Link href="/achievements" className="text-[10px] font-black text-[#D8B4FE] hover:text-white transition-colors uppercase tracking-widest">
          View All
        </Link>
      </div>
      <div className="grid grid-cols-3 gap-3">
        {loading ? (
           Array(6).fill(0).map((_, i) => (
             <div key={i} className="aspect-square rounded-xl bg-white/5 animate-pulse" />
           ))
        ) : (
          displayBadges.map((badge: any, i: number) => (
            <Badge 
              key={badge.id || i}
              icon={badge.icon || Award} 
              emoji={badge.emoji}
              color={badge.color} 
              label={badge.name || badge.label} 
              isLocked={!badge.earned}
              rarity={badge.rarity}
            />
          ))
        )}
      </div>
    </div>
  );
}

export function CommunityWidget() {
  const items = [
    { icon: MessageSquare, label: "Join Discord", sub: "12k members online", color: "#3B82F6" },
    { icon: Settings, label: "Ship Logs", sub: "Weekly dev updates", color: "#9333EA" },
    { icon: Target, label: "Mentorship", sub: "Get help from L5+", color: "#10B981" },
  ];

  return (
    <div className="rounded-2xl p-6 border border-white/5 bg-[#1E1826]/80 backdrop-blur-sm shadow-xl">
      <h2 className="text-[10px] font-black text-white mb-5 uppercase tracking-widest">Community Hub</h2>
      <div className="space-y-4">
        {items.map((item) => (
          <motion.div
            key={item.label}
            whileHover={{ x: 4 }}
            className="flex items-center gap-4 cursor-pointer hover:bg-white/5 p-2.5 -m-2.5 rounded-2xl transition-all"
          >
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-lg shadow-black/20"
              style={{ background: item.color }}
            >
              <item.icon className="w-5 h-5" />
            </div>
            <div>
              <h4 className="text-sm font-bold text-white">{item.label}</h4>
              <p className="text-[#8B7E9F] text-[10px] font-bold uppercase tracking-wider">{item.sub}</p>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}

export function ProWidget() {
  return (
    <div className="rounded-2xl p-6 border border-white/5 relative overflow-hidden bg-[#1E1826]/80 backdrop-blur-sm shadow-2xl">
      <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-[#D8B4FE]/10 rounded-full blur-2xl" />
      <h2 className="text-base font-bold text-white mb-2">Upgrade to Pro</h2>
      <p className="text-xs leading-relaxed mb-5 text-[#8B7E9F] font-medium">
        Unlock advanced metrics, priority PR reviews, and exclusive badges.
      </p>
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        className="w-full py-3 rounded-xl text-sm font-black transition-all bg-[#D8B4FE] text-[#15111A] shadow-lg shadow-[#D8B4FE]/20 uppercase tracking-widest"
      >
        Get Pro Access
      </motion.button>
    </div>
  );
}
