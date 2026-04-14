import { motion } from "framer-motion";
import { useEffect, useState } from "react";
import { account } from "@/lib/appwrite";
import { getContributionData } from "@/app/(contributor)/dashboard/actions";

const heatmapColors = ["#2A2136", "#50307B", "#7C3AED", "#9333EA", "#D8B4FE"];

export function ContributionHeatmap({ handle, forceSync = false }: { handle: string; forceSync?: boolean }) {
  const [data, setData] = useState<any[]>([]);

  useEffect(() => {
    const fetchData = async () => {
        try {
            const contributions = await getContributionData(handle, forceSync);
            setData(contributions);
        } catch (e) {
            console.error(e);
        }
    };
    fetchData();
  }, [handle, forceSync]);

  if (data.length === 0) return <div className="h-[200px] w-full bg-white/5 rounded-2xl animate-pulse" />;

  // Calculate month positions based on the data dates (checking every day for a change)
  const monthLabels: { label: string; index: number }[] = [];
  let lastMonth = "";
  data.forEach((day, i) => {
    const date = new Date(day.date);
    const month = date.toLocaleString('default', { month: 'short' });
    if (month !== lastMonth) {
      // Only push if this month hasn't been added yet (handles year crossover)
      if (!monthLabels.find(m => m.label === month)) {
        monthLabels.push({ label: month, index: Math.floor(i / 7) });
        lastMonth = month;
      }
    }
  });

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
          <div className="relative flex mb-4 text-[10px] text-[#8B7E9F] h-4">
            {monthLabels.map((m) => (
              <span 
                key={`${m.label}-${m.index}`} 
                className="absolute" 
                style={{ left: `${m.index * 15.5}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>
          <div className="flex gap-1.5 h-[90px] pl-1">
            {Array.from({ length: 52 }).map((_, col) => (
              <div key={col} className="flex flex-col gap-1.5">
                {Array.from({ length: 7 }).map((_, row) => {
                  const dayIndex = col * 7 + row;
                  const dayData = data[dayIndex] || { level: 0, count: 0, date: "" };
                  const c = heatmapColors[dayData.level];
                  return (
                    <motion.div
                      key={row}
                      title={`${dayData.count} contributions on ${dayData.date}`}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      transition={{ delay: (col * 7 + row) * 0.0005 }}
                      className="w-3 h-3 rounded-[2.5px] cursor-pointer hover:scale-150 transition-all duration-200"
                      style={{ background: dayData.level === 0 ? "rgba(255,255,255,0.05)" : c }}
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
