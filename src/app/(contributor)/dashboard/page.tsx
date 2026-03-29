"use client";
import { ArrowUp } from "lucide-react";
import { motion } from "framer-motion";
import { DashboardHeader } from "@/components/dashboard/DashboardHeader";
import { StatSection } from "@/components/dashboard/StatSection";
import { IssueFeed } from "@/components/dashboard/IssueFeed";
import { ContributionHeatmap } from "@/components/dashboard/ContributionHeatmap";
import { BadgeWidget, CommunityWidget, ProWidget } from "@/components/dashboard/SidebarWidgets";

export default function DashboardPage() {
  return (
    <div className="max-w-[1400px] mx-auto p-12 pt-16 min-h-screen">
      
      {/* Header */}
      <DashboardHeader />

      {/* 4 Stat Cards */}
      <StatSection />

      {/* Main Grid: Left side (Issues + Heatmap) + Right Sidebar */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
        
        {/* Left Column span 2 */}
        <div className="lg:col-span-2 flex flex-col gap-12">
          
          {/* Issue Columns */}
          <IssueFeed />

          {/* Heatmap Section */}
          <ContributionHeatmap />

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
