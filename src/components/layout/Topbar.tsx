"use client";
import { Bell, Search } from "lucide-react";
import { motion } from "framer-motion";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-20 px-8 backdrop-blur-xl border-b border-white/5 bg-[#060611]/80 shadow-2xl shadow-black/40">
      <div>
        <h1 className="text-xl font-display font-black text-white uppercase tracking-tight">{title}</h1>
        {subtitle && <p className="text-[10px] font-bold mt-1 uppercase tracking-widest text-[#606080]">{subtitle}</p>}
      </div>

      <div className="flex items-center gap-6">
        {/* Search */}
        <div className="hidden md:flex items-center gap-3 px-4 py-2 rounded-xl text-[10px] font-bold uppercase tracking-widest bg-white/5 border border-white/5 text-[#606080] transition-all hover:bg-white/10 hover:border-white/10 group cursor-pointer min-w-[240px]">
          <Search className="w-4 h-4 transition-colors group-hover:text-white" />
          <span className="flex-grow group-hover:text-white transition-colors">Search issues...</span>
          <kbd className="ml-4 px-2 py-1 rounded bg-white/5 text-[8px] font-black border border-white/5 shadow-inner">⌘K</kbd>
        </div>

        <div className="flex items-center gap-4">
           {/* Notifications */}
          <motion.button 
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className="relative w-10 h-10 flex items-center justify-center rounded-xl transition-all bg-white/5 border border-white/10 hover:border-[#D8B4FE]/30 group shadow-lg"
          >
            <Bell className="w-5 h-5 text-gray-400 group-hover:text-[#D8B4FE] transition-colors" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#7C3AED] shadow-[0_0_12px_rgba(124,58,237,0.8)] animate-pulse" />
          </motion.button>

          {/* Avatar Snapshot */}
          <motion.div 
            whileHover={{ scale: 1.05 }}
            className="w-10 h-10 rounded-xl flex items-center justify-center text-[10px] font-black text-white bg-gradient-to-br from-[#7C3AED] to-[#B78AF7] cursor-pointer shadow-lg shadow-[#7C3AED]/20 uppercase tracking-tighter"
          >
            SS
          </motion.div>
        </div>
      </div>
    </header>
  );
}
