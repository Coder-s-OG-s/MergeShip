"use client";
import Link from "next/link";
import { Clock, Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

interface IssueCardProps {
  repo: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  labels: string[];
  time: string;
  xp: number;
  highlight?: string;
  url: string;
  className?: string;
}

const difficultyColors = {
  EASY: { text: "#4ADE80", bg: "rgba(74,222,128,0.1)", dot: "bg-[#4ADE80]" },
  MEDIUM: { text: "#FACC15", bg: "rgba(250,204,21,0.1)", dot: "bg-[#FACC15]" },
  HARD: { text: "#EF4444", bg: "rgba(239,68,68,0.1)", dot: "bg-[#EF4444]" },
};

export function IssueCard({
  repo,
  title,
  difficulty,
  labels,
  time,
  xp,
  highlight,
  url,
  className,
}: IssueCardProps) {
  const { text, bg } = difficultyColors[difficulty];

  return (
    <Link 
      href={url} 
      target="_blank" 
      rel="noopener noreferrer"
      className="block no-underline"
      onClick={(e) => e.stopPropagation()}
    >
      <motion.div
        whileHover={{ y: -4, borderColor: "rgba(216, 180, 254, 0.3)" }}
        className={cn(
          "rounded-2xl p-5 border border-white/5 transition-colors cursor-pointer bg-[#1E1826]/80 flex flex-col min-h-[220px] hover:bg-[#251D2F] group relative z-0",
          className
        )}
      >
        <div className="flex items-center gap-2 mb-4 text-[#8B7E9F] text-xs font-medium">
          <div className="w-5 h-5 rounded-full flex items-center justify-center bg-white/5">
            <div className="w-2 h-2 rounded bg-current opacity-70" />
          </div>
          <span>{repo}</span>
        </div>

        <div className="flex flex-col gap-2 mb-4 flex-grow">
          <h4 className="font-bold text-white text-base leading-snug group-hover:text-[#D8B4FE] transition-colors">
            {title}
          </h4>
          {highlight && (
            <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 w-fit border border-blue-500/10">
              <span className="text-[10px] font-bold text-blue-400 font-sans tracking-wide">
                {highlight}
              </span>
            </div>
          )}
        </div>

        <div className="flex flex-wrap gap-2 mb-6">
          <span className="text-[10px] font-bold px-2 py-0.5 rounded uppercase" style={{ background: bg, color: text }}>
            {difficulty}
          </span>
          {labels.map((label) => (
            <span key={label} className="text-[10px] font-bold px-2 py-0.5 rounded bg-white/5 text-[#8B7E9F]">
              {label}
            </span>
          ))}
        </div>

        <div className="flex items-center justify-between text-xs font-bold mt-auto pt-4 border-t border-white/5">
          <span className="text-[#8B7E9F] flex items-center gap-1.5">
            <Clock className="w-3.5 h-3.5" /> {time}
          </span>
          <span className="text-[#D8B4FE] flex items-center gap-1.5">
            <Star className="w-3.5 h-3.5" /> {xp} XP
          </span>
        </div>
      </motion.div>
    </Link>
  );
}
