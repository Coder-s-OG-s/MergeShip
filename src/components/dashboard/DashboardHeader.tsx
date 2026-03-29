"use client";
import { Rocket } from "lucide-react";
import { motion } from "framer-motion";

export function DashboardHeader() {
  return (
    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-12 gap-6">
      <motion.div
        initial={{ x: -20, opacity: 0 }}
        animate={{ x: 0, opacity: 1 }}
      >
        <h1 className="text-4xl font-display font-black text-white mb-2 tracking-tight">
          Welcome back, <span className="text-[#D8B4FE]">Captain</span>
        </h1>
        <p className="text-[#8B7E9F] font-bold text-xs uppercase tracking-[0.2em]">
          You're 850 XP away from reaching Level 4.
        </p>
      </motion.div>
      <motion.button
        whileHover={{ scale: 1.05, shadow: "0 0 20px rgba(216, 180, 254, 0.4)" }}
        whileTap={{ scale: 0.95 }}
        className="flex items-center gap-3 px-8 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all bg-[#D8B4FE] text-[#15111A] shadow-xl shadow-[#D8B4FE]/10"
      >
        <Rocket className="w-5 h-5" />
        Get Today's Issues
      </motion.button>
    </div>
  );
}
