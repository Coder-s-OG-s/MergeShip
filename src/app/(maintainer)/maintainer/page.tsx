"use client";

import { useEffect, useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { motion, AnimatePresence } from "framer-motion";
import { KpiBanner } from "@/components/dashboard/maintainer/KpiBanner";
import { PriorityQueue } from "@/components/dashboard/maintainer/PriorityQueue";
import { OpenPRs } from "@/components/dashboard/maintainer/OpenPRs";
import { StaleIssues, TodayStats } from "@/components/dashboard/maintainer/StaleIssues";
import { RepoHealthMini, TeamSnapshot, ActivityFeed } from "@/components/dashboard/maintainer/SidebarWidgets";
import { account } from "@/lib/appwrite";
import { getMaintainerDashboardData } from "./actions";

export default function MaintainerDashboardPage() {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"queue" | "prs">("queue");

  useEffect(() => {
    const init = async () => {
      try {
        const session = await account.get();
        let handle = session.name.replace(/\s+/g, '-').toLowerCase();
        let token = "";
        
        const identities = await account.listIdentities();
        const gh = identities.identities.find(id => id.provider.toLowerCase() === 'github');
        if (gh) {
          token = (gh as any).providerAccessToken;
          // Use hard-linked handle if current user is Ayush Patel
          if (session.name.toLowerCase().includes("ayush patel")) {
            handle = "Ayush-Patel-56";
          } else {
            const res = await fetch(`https://api.github.com/user/${gh.providerUid}`);
            if (res.ok) {
              const d = await res.json();
              handle = d.login;
            }
          }
        } else if (session.name.toLowerCase().includes("ayush patel")) {
          handle = "Ayush-Patel-56";
        }

        const res = await getMaintainerDashboardData(handle, token);
        if (res.success) {
          setData(res);
        }
      } catch (e) {
        console.error("Maintainer init failed", e);
      } finally {
        setLoading(false);
      }
    };
    init();
  }, []);

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center bg-[#060611]">
      <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin" />
    </div>
  );

  if (!data || data.empty) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-[#060611] text-white p-6 text-center">
      <h1 className="text-2xl font-black mb-4 uppercase tracking-widest">No Maintained Repositories</h1>
      <p className="text-gray-400 max-w-md">We couldn't find any repositories where you are an owner or collaborator. Contribute to more projects to see them here!</p>
    </div>
  );

  return (
    <div className="min-h-screen bg-[#060611] font-sans pb-20">
      <Topbar title="Command Center" subtitle={`Managing ${data.mainRepo} and more`} />

      <div className="p-12 max-w-[1600px] mx-auto space-y-12">

        {/* KPI Banner */}
        <KpiBanner 
          online={`${data.stats.teamOnline}/${data.stats.teamTotal}`} 
          urgent={data.stats.urgentCount} 
          openPRsCount={data.stats.openPRsCount} 
        />

        {/* Main 2-col layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">

          {/* Left col: tab panel */}
          <div className="lg:col-span-2 space-y-12">

            {/* Tab switcher */}
            <div className="flex items-center gap-2 p-1.5 rounded-2xl w-fit bg-white/5 border border-white/10 shadow-inner">
              {(["queue", "prs"] as const).map(tab => (
                <motion.button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all relative ${
                    activeTab === tab ? "text-white" : "text-[#606080] hover:text-white"
                  }`}
                >
                  {activeTab === tab && (
                    <motion.div
                      layoutId="maintainer-tab"
                      className="absolute inset-0 bg-cyan-600 rounded-xl shadow-lg shadow-cyan-600/20"
                    />
                  )}
                  <span className="relative z-10">{tab === "queue" ? "Priority Queue" : "Open PRs"}</span>
                </motion.button>
              ))}
            </div>

            <AnimatePresence mode="wait">
              {activeTab === "queue" ? (
                <motion.div
                  key="queue"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <PriorityQueue issues={data.urgentIssues} />
                </motion.div>
              ) : (
                <motion.div
                  key="prs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <OpenPRs prs={data.openPRs} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stale issues */}
            <StaleIssues issues={data.staleIssues} />
          </div>

          {/* Right col: team + activity */}
          <div className="space-y-8">
            
            <RepoHealthMini health={data.repoHealth} />

            <TeamSnapshot members={data.teamMembers} />

            <ActivityFeed feed={data.activityFeed} />

            <TodayStats stats={[
              { label: "New Issues", value: data.stats.urgentCount + 5, textColor: "text-white" },
              { label: "PRs Merged", value: data.stats.mergedToday, textColor: "text-emerald-400" },
              { label: "Issues Closed", value: "11", textColor: "text-cyan-400" },
              { label: "Active Contributors", value: "23", textColor: "text-purple-400" },
              { label: "Avg Response Time", value: "2.8h", textColor: "text-amber-400" },
            ]} />
            
          </div>
        </div>
      </div>
    </div>
  );
}

