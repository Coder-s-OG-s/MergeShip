"use client";
import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface StatCardProps {
  label: string;
  value: string | number;
  subtext?: string;
  icon: LucideIcon;
  iconColor?: string;
  className?: string;
}

export function StatCard({
  label,
  value,
  subtext,
  icon: Icon,
  iconColor = "#D8B4FE",
  className,
}: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className={cn(
        "rounded-2xl p-6 border border-white/5 relative group bg-[#1E1826]/80 backdrop-blur-sm",
        className
      )}
    >
      <div className="absolute top-6 right-6" style={{ color: iconColor }}>
        <Icon className="w-5 h-5" />
      </div>
      <p className="text-xs font-bold tracking-wider mb-2 text-[#8B7E9F] uppercase">{label}</p>
      <h2 className="text-3xl font-bold text-white mb-2">{value}</h2>
      {subtext && <p className="text-xs text-[#8B7E9F] font-medium">{subtext}</p>}
    </motion.div>
  );
}

export function LevelStatCard({
  level,
  progress,
}: {
  level: string;
  progress: number;
}) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="rounded-2xl p-6 border border-white/5 relative overflow-hidden group bg-[#1E1826]/80 backdrop-blur-sm"
    >
      <div className="absolute top-6 right-6 text-[#D8B4FE]">
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="w-5 h-5"
        >
          <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
        </svg>
      </div>
      <p className="text-xs font-bold tracking-wider mb-2 text-[#8B7E9F] uppercase">Current Level</p>
      <h2 className="text-2xl font-bold text-white mb-6">{level}</h2>
      <div className="flex items-center gap-3">
        <div className="flex-1 h-1.5 rounded-full bg-white/5 relative overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="absolute top-0 left-0 h-full rounded-full"
            style={{
              background: "linear-gradient(90deg, #9333EA, #D8B4FE)",
            }}
          />
        </div>
        <span className="text-[10px] font-bold text-[#D8B4FE]">{progress}%</span>
      </div>
    </motion.div>
  );
}
