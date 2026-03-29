"use client";
import { LayoutDashboard, AlertTriangle, Users2, BarChart3 } from "lucide-react";
import { BaseSidebar, NavItem } from "./BaseSidebar";

const navItems: NavItem[] = [
  { href: "/maintainer", icon: LayoutDashboard, label: "Command Center", exact: true },
  { href: "/maintainer/triage", icon: AlertTriangle, label: "Issue Triage" },
  { href: "/maintainer/team", icon: Users2, label: "Team & Workload" },
  { href: "/maintainer/analytics", icon: BarChart3, label: "Analytics" },
];

export function MaintainerSidebar() {
  return (
    <BaseSidebar
      mode="MAINTAINER"
      navItems={navItems}
      brandColor="#22D3EE"
      brandGradient="linear-gradient(135deg, #0E7490, #22D3EE)"
      switchModeHref="/dashboard"
      switchModeLabel="Contributor View"
      user={{
        name: "Alex Chen",
        role: "Lead Maintainer",
        initials: "AC"
      }}
      organization={{
        name: "vercel/*",
        repos: "4",
        members: "4"
      }}
    />
  );
}
