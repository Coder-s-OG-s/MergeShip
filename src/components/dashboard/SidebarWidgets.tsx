"use client";
import { CheckCircle, Flame, Bug, Award, Shield, MessageSquare, Settings, Target } from "lucide-react";
import { motion } from "framer-motion";

export function BadgeWidget() {
  return (
    <div className="rounded-2xl p-6 border border-white/5 bg-[#1E1826]/80 backdrop-blur-sm shadow-xl">
      <div className="flex items-center justify-between mb-5">
        <h2 className="text-base font-bold text-white uppercase tracking-widest text-[10px]">Recent Badges</h2>
        <button className="text-[10px] font-black text-[#D8B4FE] hover:underline uppercase tracking-widest">
          View All
        </button>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <Badge icon={CheckCircle} color="#4ADE80" label="PIONEER" />
        <Badge icon={Flame} color="#F97316" label="HOT" />
        <Badge icon={Bug} color="#D8B4FE" label="EXTERMINATOR" />
        <Badge icon={Award} color="#8B7E9F" label="LOCKED" isLocked />
        <Badge icon={Shield} color="#8B7E9F" label="LOCKED" isLocked />
        <Badge icon={Award} color="#8B7E9F" label="LOCKED" isLocked />
      </div>
    </div>
  );
}

function Badge({ icon: Icon, color, label, isLocked }: any) {
  return (
    <motion.div
      whileHover={!isLocked ? { scale: 1.05 } : {}}
      className={`flex flex-col items-center justify-center p-3 rounded-2xl bg-[#2A2136]/50 border transition-all ${
        isLocked ? "border-white/5 opacity-40 grayscale" : "border-[#D8B4FE]/20"
      }`}
    >
      <Icon className="w-6 h-6 mb-2" style={{ color: !isLocked ? color : "#8B7E9F" }} />
      <span className="text-[8px] font-black tracking-widest text-center leading-none text-[#8B7E9F]">
        {label}
      </span>
    </motion.div>
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
