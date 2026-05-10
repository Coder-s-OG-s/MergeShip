"use client";
import { useEffect, useState } from "react";
import { LayoutDashboard, Zap, Trophy, User, UsersRound } from "lucide-react";
import { BaseSidebar, NavItem } from "./BaseSidebar";
import { account } from "@/lib/appwrite";
import { getDashboardData } from "@/app/(contributor)/dashboard/actions";

const navItems: NavItem[] = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard", exact: true },
  { href: "/issues", icon: Zap, label: "Issue Feed" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/portfolio", icon: User, label: "My Portfolio" },
  { href: "/community", icon: UsersRound, label: "Community" },
];

export function ContributorSidebar() {
  const [userData, setUserData] = useState<any>({
    name: "Loading...",
    level: "..",
    xp: "...",
    initials: "?",
    streak: 0
  });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await account.get();
        const identities = await account.listIdentities();
        const githubIdentity = identities.identities.find(id => id.provider.toLowerCase() === 'github');
        
        let handle = session.name.replace(/\s+/g, '').toLowerCase();
        if (session.name.toLowerCase().includes("ayush patel")) {
           handle = "Ayush-Patel-56";
        } else if (githubIdentity) {
           const userRes = await fetch(`https://api.github.com/user/${githubIdentity.providerUid}`);
           if (userRes.ok) {
              const d = await userRes.json();
              handle = d.login;
           }
        }

        // Get stats for level and XP
        const statsRes = await getDashboardData(handle);
        
        setUserData({
          name: handle,
          level: statsRes.success ? (statsRes.stats.levelCode || "L1") : "L1",
          xp: statsRes.success ? `${statsRes.stats.totalXP} XP` : "0 XP",
          initials: session.name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2),
          streak: statsRes.success ? statsRes.stats.streak : 0
        });
      } catch (error) {
        console.error("Sidebar user fetch failed", error);
      }
    };
    fetchUser();
  }, []);
  return (
    <BaseSidebar
      mode="CONTRIBUTOR"
      navItems={navItems}
      brandColor="#B78AF7"
      brandGradient="linear-gradient(135deg, #B78AF7, #7C3AED)"
      switchModeHref="/maintainer"
      switchModeLabel="Maintainer Hub"
      user={userData}
    />
  );
}
