"use client";
import { useState } from "react";
import { Topbar } from "@/components/layout/Topbar";
import { mockPriorityIssues, mockTeamMembers, mockStaleIssues, mockAnalytics } from "@/data/maintainers";
import { motion, AnimatePresence } from "framer-motion";
import { KpiBanner } from "@/components/dashboard/maintainer/KpiBanner";
import { PriorityQueue } from "@/components/dashboard/maintainer/PriorityQueue";
import { OpenPRs } from "@/components/dashboard/maintainer/OpenPRs";
import { StaleIssues, TodayStats } from "@/components/dashboard/maintainer/StaleIssues";
import { RepoHealthMini, TeamSnapshot, ActivityFeed } from "@/components/dashboard/maintainer/SidebarWidgets";
import { GitMerge, AlertTriangle, CheckCircle, GitPullRequest, MessageSquare } from "lucide-react";

const activityFeed = [
  { type: "merge", user: "alice_dev", action: "merged PR #1847", repo: "vercel/next.js", time: "2m ago", color: "#10B981", icon: GitMerge },
  { type: "open", user: "dev_raj", action: "opened issue #2031", repo: "vercel/swr", time: "8m ago", color: "#06B6D4", icon: AlertTriangle },
  { type: "close", user: "Alex Chen", action: "closed 3 stale issues", repo: "vercel/turbo", time: "15m ago", color: "#A78BFA", icon: CheckCircle },
  { type: "review", user: "Jenny Park", action: "requested changes on PR #1843", repo: "vercel/next.js", time: "22m ago", color: "#F59E0B", icon: GitPullRequest },
  { type: "star", user: "css_wizard", action: "left a comment on issue #2028", repo: "tailwindlabs/tailwindcss", time: "31m ago", color: "#EC4899", icon: MessageSquare },
];

const openPRs = [
  { id: 1847, title: "Fix RSC serialization edge case for circular refs", author: "alice_dev", reviewers: ["AC", "JP"], additions: 142, deletions: 38, status: "approved", repo: "vercel/next.js" },
  { id: 1843, title: "Improve hydration error messaging with diff view", author: "pro_coder42", reviewers: ["MT"], additions: 87, deletions: 22, status: "changes_requested", repo: "vercel/next.js" },
  { id: 412, title: "Add useSWRSubscription TypeScript generics", author: "css_wizard", reviewers: [], additions: 54, deletions: 11, status: "pending", repo: "vercel/swr" },
];

export default function MaintainerDashboardPage() {
  const [activeTab, setActiveTab] = useState<"queue" | "prs">("queue");
  const online = `${mockTeamMembers.filter(m => m.status === "online").length}/${mockTeamMembers.length}`;
  const urgent = mockPriorityIssues.filter(i => i.priority === "critical" || i.priority === "high").length;

  return (
    <div className="min-h-screen bg-[#060611] font-sans pb-20">
      <Topbar title="Command Center" subtitle="Managing vercel/* repositories" />

      <div className="p-12 max-w-[1600px] mx-auto space-y-12">

        {/* KPI Banner */}
        <KpiBanner online={online} urgent={urgent} openPRsCount={openPRs.length} />

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
                  <PriorityQueue issues={mockPriorityIssues} />
                </motion.div>
              ) : (
                <motion.div
                  key="prs"
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -20 }}
                >
                  <OpenPRs prs={openPRs} />
                </motion.div>
              )}
            </AnimatePresence>

            {/* Stale issues */}
            <StaleIssues issues={mockStaleIssues} />
          </div>

          {/* Right col: team + activity */}
          <div className="space-y-8">
            
            <RepoHealthMini health={mockAnalytics.repoHealth} />

            <TeamSnapshot members={mockTeamMembers} />

            <ActivityFeed feed={activityFeed} />

            <TodayStats stats={[
              { label: "New Issues", value: "14", textColor: "text-white" },
              { label: "PRs Merged", value: "7", textColor: "text-emerald-400" },
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
