"use client";
import { LayoutDashboard, Zap, Trophy, User, UsersRound } from "lucide-react";
import { BaseSidebar, NavItem } from "./BaseSidebar";

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/issues", icon: Zap, label: "Issue Feed" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/portfolio", icon: User, label: "My Portfolio" },
  { href: "/community", icon: UsersRound, label: "Community" },
];

export function ContributorSidebar() {
  return (
    <BaseSidebar
      mode="CONTRIBUTOR"
      navItems={navItems}
      brandColor="#B78AF7"
      brandGradient="linear-gradient(135deg, #B78AF7, #7C3AED)"
      switchModeHref="/maintainer"
      switchModeLabel="Maintainer Hub"
      user={{
        name: "soumyasagar",
        level: "L3",
        xp: "420 XP",
        initials: "SS",
        streak: 7
      }}
    />
  );
}
