import { Medal, Star, Flame, Award, TrendingUp } from "lucide-react";
import { StatCard, LevelStatCard } from "@/components/ui/StatCard";
import { useEffect, useState } from "react";
import { getDashboardData } from "@/app/(contributor)/dashboard/actions";
import { account } from "@/lib/appwrite";

export function StatSection() {
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const session = await account.get();
        const identities = await account.listIdentities();
        const githubIdentity = identities.identities.find(id => id.provider === 'github');
        
        // Match the logic in onboarding to get handle
        let githubHandle = '';
        if (githubIdentity) {
           const userRes = await fetch(`https://api.github.com/user/${githubIdentity.providerUid}`);
           if (userRes.ok) {
              const userData = await userRes.json();
              githubHandle = userData.login;
           }
        }
        if (!githubHandle) githubHandle = session.name.replace(/\s+/g, '').toLowerCase();

        const data = await getDashboardData(githubHandle);
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
  }, []);

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
        label="Total XP"
        value={stats.totalXP}
        icon={Star}
        subtext={`Active in ${stats.repos} repos`}
        className="relative"
      />

      <StatCard
        label="Work Streak"
        value={`${stats.streak} Days 🔥`}
        icon={Flame}
        iconColor="#F97316"
        subtext="Consistent progress"
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
