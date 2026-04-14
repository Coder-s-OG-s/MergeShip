"use client";
import { useEffect, useState } from "react";
import { LayoutDashboard, AlertTriangle, Users2, BarChart3 } from "lucide-react";
import { BaseSidebar, NavItem } from "./BaseSidebar";
import { account } from "@/lib/appwrite";

const navItems: NavItem[] = [
  { href: "/maintainer", icon: LayoutDashboard, label: "Command Center", exact: true },
  { href: "/maintainer/triage", icon: AlertTriangle, label: "Issue Triage" },
  { href: "/maintainer/team", icon: Users2, label: "Team & Workload" },
  { href: "/maintainer/analytics", icon: BarChart3, label: "Analytics" },
];

export function MaintainerSidebar() {
  const [userData, setUserData] = useState({ name: "User", initials: "U" });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await account.get();
        const name = session.name || "User";
        const initials = name
          .split(" ")
          .map((n) => n[0])
          .join("")
          .toUpperCase()
          .slice(0, 2);
        setUserData({ name, initials });
      } catch (e) {
        console.error("Failed to fetch user in sidebar", e);
      } finally {
        setLoading(false);
      }
    };
    fetchUser();
  }, []);

  return (
    <BaseSidebar
      mode="MAINTAINER"
      navItems={navItems}
      brandColor="#22D3EE"
      brandGradient="linear-gradient(135deg, #0E7490, #22D3EE)"
      switchModeHref="/dashboard"
      switchModeLabel="Contributor View"
      user={{
        name: userData.name,
        role: "Lead Maintainer",
        initials: userData.initials
      }}
      organization={{
        name: "My Projects",
        repos: "Auto",
        members: "Global"
      }}
    />
  );
}
