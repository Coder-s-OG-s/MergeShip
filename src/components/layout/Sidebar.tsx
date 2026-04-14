"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard, Zap, Trophy, User,
  GitMerge, AlertTriangle, Users2, BarChart3,
  MessageSquare, UsersRound, Rocket, Star,
  ChevronRight
} from "lucide-react";
import { clsx } from "clsx";
import { account } from "@/lib/appwrite";

const contributorNav = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/issues", icon: Zap, label: "Issue Feed" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/portfolio", icon: User, label: "My Portfolio" },
];

const maintainerNav = [
  { href: "/maintainer", icon: LayoutDashboard, label: "Command Center" },
  { href: "/maintainer/triage", icon: AlertTriangle, label: "Issue Triage" },
  { href: "/maintainer/team", icon: Users2, label: "Team & Workload" },
  { href: "/maintainer/analytics", icon: BarChart3, label: "Analytics" },
];

const communityNav = [
  { href: "/community", icon: UsersRound, label: "My Groups" },
];

type NavSection = { title: string; items: typeof contributorNav; color: string };

const navSections: NavSection[] = [
  { title: "Contributor", items: contributorNav, color: "text-purple-400" },
  { title: "Maintainer", items: maintainerNav, color: "text-cyan-400" },
  { title: "Community", items: communityNav, color: "text-pink-400" },
];

export function Sidebar() {
  const pathname = usePathname();
  const [userData, setUserData] = useState({ name: "User", initials: "U", level: "L1", xp: "0" });

  useEffect(() => {
    const fetchUser = async () => {
      try {
        const session = await account.get();
        const name = session.name || "User";
        const initials = name.split(" ").map(n => n[0]).join("").toUpperCase().slice(0, 2);
        
        // Resolve handle for stats fetch
        let handle = name.replace(/\s+/g, '-').toLowerCase();
        if (name.toLowerCase().includes("ayush patel")) {
           handle = "Ayush-Patel-56";
        }

        // Try to get stats from dashboard actions (which uses Appwrite cache)
        const { getDashboardData } = await import("@/app/(contributor)/dashboard/actions");
        const statsRes = await getDashboardData(handle);
        
        setUserData({ 
          name, 
          initials, 
          level: statsRes.success ? statsRes.stats.level.split(' ')[0] : "L1",
          xp: statsRes.success ? statsRes.stats.totalXP : "0"
        });
      } catch (e) {}
    };
    fetchUser();
  }, []);

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40"
      style={{ background: "linear-gradient(180deg, #0D0D1A 0%, #060611 100%)", borderRight: "1px solid rgba(255,255,255,0.06)" }}>
      
      {/* Logo */}
      <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <Link href="/" className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-purple"
            style={{ background: "linear-gradient(135deg, #7C3AED, #5B21B6)" }}>
            <GitMerge className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-800 text-white text-lg leading-none">MergeShip</p>
            <p className="text-xs mt-0.5" style={{ color: "#606080" }}>v0.1.0</p>
          </div>
        </Link>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto p-4 space-y-6">
        {navSections.map((section) => (
          <div key={section.title}>
            <p className={clsx("text-xs font-semibold uppercase tracking-widest mb-2 px-3", section.color)}>
              {section.title}
            </p>
            <ul className="space-y-1">
              {section.items.map(({ href, icon: Icon, label }) => {
                const isActive = pathname === href || (href !== "/" && href !== "/maintainer" && pathname.startsWith(href));
                const isExact = href === "/maintainer" ? pathname === "/maintainer" : isActive;
                return (
                  <li key={href}>
                    <Link
                      href={href}
                      className={clsx(
                        "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                        isExact
                          ? "nav-active"
                          : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                      )}
                    >
                      <Icon className="w-4 h-4 flex-shrink-0" />
                      <span className="flex-1">{label}</span>
                      {isExact && <ChevronRight className="w-3 h-3 opacity-60" />}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </nav>

      {/* User card at bottom */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="glass-card rounded-xl p-3 flex items-center gap-3">
          <div className="relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white level-badge bg-gradient-to-br from-purple-600 to-blue-600 shadow-lg">
              {userData.initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-online"
              style={{ borderColor: "#0D0D1A" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">{userData.name.toLowerCase().replace(/\s/g, '')}</p>
            <p className="text-xs" style={{ color: "#A78BFA" }}>{userData.level} · {userData.xp} Contributions</p>
          </div>
          <div className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.3)" }}>
            🔥 1
          </div>
        </div>
      </div>
    </aside>
  );
}
