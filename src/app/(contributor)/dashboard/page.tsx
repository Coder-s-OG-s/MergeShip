"use client";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatSection } from "@/components/dashboard/StatSection";
import { IssueFeed } from "@/components/dashboard/IssueFeed";
import { ContributionHeatmap } from "@/components/dashboard/ContributionHeatmap";
import { BadgeWidget, CommunityWidget, ProWidget } from "@/components/dashboard/SidebarWidgets";
import { useEffect, useState } from "react";
import { account } from "@/lib/appwrite";

export default function DashboardPage() {
  const [githubHandle, setGithubHandle] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);

  const handleSync = () => {
    setRefreshKey(prev => prev + 1);
  };

  useEffect(() => {
    const resolveHandle = async () => {
      try {
        const session = await account.get();
        let handle = session.name.replace(/\s+/g, '-').toLowerCase();
        
        // Resolve the REAL GitHub username from the Appwrite identity
        if (session.name.toLowerCase().startsWith("ayush patel")) {
          handle = "Ayush-Patel-56";
        } else {
          const identities = await account.listIdentities();
          const githubIdentity = identities.identities.find(id => id.provider.toLowerCase() === 'github');
          if (githubIdentity) {
            try {
              const res = await fetch(`https://api.github.com/user/${githubIdentity.providerUid}`);
              if (res.ok) {
                const data = await res.json();
                handle = data.login;
              }
            } catch (e) {
              console.error("GitHub handle resolution failed", e);
            }
          }
        }
        
        console.log("[MergeShip] Resolved GitHub handle:", handle);
        setGithubHandle(handle);
      } catch (e) {
        console.error("Handle resolution failed", e);
      } finally {
        setLoading(false);
      }
    };
    resolveHandle();
  }, []);

  if (loading || !githubHandle) {
    return <div className="min-h-screen bg-dark-900 flex items-center justify-center">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#D8B4FE]" />
    </div>;
  }

  return (
    <div className="max-w-[1400px] mx-auto p-12 pt-16 min-h-screen">
      
      {/* Header */}
      <DashboardHeader onSync={handleSync} isSyncing={refreshKey > 0} />

      {/* 4 Stat Cards */}
      <StatSection handle={githubHandle} key={`stats-${refreshKey}`} forceSync={refreshKey > 0} />

      {/* Main Grid: Left side (Issues + Heatmap) + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column span 2 */}
        <div className="lg:col-span-2 flex flex-col gap-12">
          
          {/* Issue Columns */}
          <IssueFeed handle={githubHandle} key={`issues-${refreshKey}`} forceSync={refreshKey > 0} />

          {/* Heatmap Section */}
          <ContributionHeatmap handle={githubHandle} key={`heatmap-${refreshKey}`} forceSync={refreshKey > 0} />

        </div>

        {/* Right Sidebar */}
        <div className="flex flex-col gap-8">
          
          {/* Recent Badges */}
          <BadgeWidget />

          {/* Community */}
          <CommunityWidget />

          {/* Upgrade to Pro */}
          <ProWidget />

        </div>

      </div>

      {/* Basic Footer inside main wrapper */}
      <footer className="mt-20 py-10 border-t border-white/5 flex flex-col md:flex-row items-center justify-between text-[10px] font-black tracking-widest text-[#8B7E9F] uppercase">
        <div className="flex items-center gap-3 mb-6 md:mb-0">
          <ArrowUp className="w-4 h-4 text-[#D8B4FE]" />
          <span>© 2026 MergeShip // Build together, level up faster.</span>
        </div>
        <div className="flex items-center gap-8">
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
          <a href="#" className="hover:text-white transition-colors">Terms</a>
          <a href="#" className="hover:text-white transition-colors">API Docs</a>
          <a href="#" className="hover:text-white transition-colors">Status</a>
        </div>
      </footer>
    </div>
  );
}
