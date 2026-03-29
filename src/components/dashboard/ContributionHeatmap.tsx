"use client";
import { motion } from "framer-motion";

const heatmapColors = ["#2A2136", "#50307B", "#7C3AED", "#9333EA", "#D8B4FE"];

export function ContributionHeatmap() {
  return (
    <div className="rounded-2xl p-6 border border-white/5 bg-[#1E1826]/80 backdrop-blur-sm" style={{ background: "#1E1826" }}>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-base font-bold text-white">Contribution Heatmap</h2>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-[#8B7E9F]">
          <span className="opacity-70">LESS</span>
          <div className="flex gap-1">
            {heatmapColors.map((c) => (
              <div
                key={c}
                className="w-3 h-3 rounded-sm"
                style={{ background: c }}
              />
            ))}
          </div>
          <span className="opacity-70">MORE</span>
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto pb-2 scrollbar-hide" style={{ height: "130px" }}>
        <div className="flex flex-col justify-between text-[10px] text-[#8B7E9F] pt-8 pb-4 mr-2">
          <span>MON</span>
          <span>WED</span>
          <span>FRI</span>
        </div>
        <div className="flex-1 min-w-[800px]">
          <div className="flex gap-1.5 mb-2 text-[10px] text-[#8B7E9F] pl-1">
            {["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"].map(
              (m) => (
                <span key={m} className="w-12">
                  {m}
                </span>
              )
            )}
          </div>
          <div className="flex gap-1.5 h-[80px] pl-1">
            {Array.from({ length: 52 }).map((_, col) => (
              <div key={col} className="flex flex-col gap-1.5">
                {Array.from({ length: 5 }).map((_, row) => {
                  const c =
                    heatmapColors[Math.floor(Math.random() * heatmapColors.length)];
                  return (
                    <motion.div
                      key={row}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: (col * 5 + row) * 0.002 }}
                      className="w-3 h-3 rounded-sm cursor-pointer hover:scale-125 transition-transform"
                      style={{ background: c }}
                    />
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      <p className="text-center text-[10px] mt-4 font-bold tracking-widest text-[#8B7E9F]">
        YOUR LAST 365 DAYS OF MERGE ACTIVITY
      </p>
    </div>
  );
}
