import { Medal, Star, Flame, Award, TrendingUp } from "lucide-react";
import { StatCard, LevelStatCard } from "@/components/ui/StatCard";
import { useEffect, useState } from "react";
import { getDashboardData } from "@/app/(contributor)/dashboard/actions";
import { account } from "@/lib/appwrite";

export function StatSection({ handle, forceSync = false }: { handle: string; forceSync?: boolean }) {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getDashboardData(handle, forceSync);
        if (data.success) {
          setStats(data.stats);
        }
      } catch (error) {
        console.error("Failed to load dashboard stats", error);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [handle, forceSync]);

  if (loading || !stats) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 animate-pulse opacity-50">
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
        <div className="h-32 bg-white/5 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-5 mb-8 text-white">
      <LevelStatCard level={stats.level} progress={stats.progress} />
      
      <StatCard
        label="Contributions"
        value={stats.totalXP}
        icon={Star}
        subtext={`Active in ${stats.repos} repos`}
        className="relative"
      />

      <StatCard
        label="Total Active Days"
        value={`${stats.activeDays || 0} Days`}
        icon={TrendingUp}
        iconColor="#10B981"
        subtext="Days with merged activity"
      />

      <StatCard
        label="Followers"
        value={stats.followers.toString()}
        icon={Award}
        subtext="GitHub Audience"
      />
    </div>
  );
}
