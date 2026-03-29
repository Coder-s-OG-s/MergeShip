"use client";
import { Medal, Star, Flame, Award, TrendingUp } from "lucide-react";
import { StatCard, LevelStatCard } from "@/components/ui/StatCard";

export function StatSection() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8">
      <LevelStatCard level="L3 Intermediate" progress={65} />
      
      <StatCard
        label="Total XP"
        value="12,450"
        icon={Star}
        subtext="+450 this week"
        className="relative"
      />

      <StatCard
        label="Work Streak"
        value="14 Days 🔥"
        icon={Flame}
        iconColor="#F97316"
        subtext="Personal record: 22 days"
      />

      <StatCard
        label="Badges Earned"
        value="28"
        icon={Award}
        subtext="Top 5% of contributors"
      />
    </div>
  );
}
