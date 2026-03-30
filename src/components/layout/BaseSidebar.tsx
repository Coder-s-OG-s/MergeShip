"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LucideIcon, GitMerge, ChevronRight, ArrowLeftRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface NavItem {
  href: string;
  icon: LucideIcon;
  label: string;
  exact?: boolean;
}

interface BaseSidebarProps {
  navItems: NavItem[];
  mode: "CONTRIBUTOR" | "MAINTAINER";
  switchModeHref: string;
  switchModeLabel: string;
  brandColor: string;
  brandGradient?: string;
  user: {
    name: string;
    level?: string;
    xp?: string;
    initials: string;
    role?: string;
    streak?: number;
  };
  organization?: {
    name: string;
    repos: string;
    members: string;
  };
}

export function BaseSidebar({
  navItems,
  mode,
  switchModeHref,
  switchModeLabel,
  brandColor,
  brandGradient,
  user,
  organization,
}: BaseSidebarProps) {
  const pathname = usePathname();

  return (
    <aside
      className="fixed left-0 top-0 h-full w-64 flex flex-col z-40 border-r border-white/5 transition-all duration-300"
      style={{
        background: mode === "MAINTAINER" ? "linear-gradient(180deg, #050E14 0%, #030810 100%)" : "#110E15",
        borderColor: mode === "MAINTAINER" ? "rgba(6,182,212,0.1)" : "rgba(255,255,255,0.05)",
      }}
    >
      {/* Brand */}
      <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Link href="/" className="flex items-center gap-3 mb-6 transition-transform hover:scale-105">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center shadow-lg"
            style={{
              background: brandGradient || brandColor,
              color: "#110E15",
              boxShadow: mode === "MAINTAINER" ? "0 0 20px rgba(6,182,212,0.4)" : "none",
            }}
          >
            <GitMerge className="w-6 h-6" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-xl leading-none">MergeShip</p>
            <p className="text-[10px] mt-1 tracking-widest text-[#606080] font-bold">v0.1.0</p>
          </div>
        </Link>
        <div
          className="flex items-center gap-2 px-3 py-2.5 rounded-xl border"
          style={{
            background: mode === "MAINTAINER" ? "rgba(6,182,212,0.12)" : "rgba(183,138,247,0.1)",
            borderColor: mode === "MAINTAINER" ? "rgba(6,182,212,0.3)" : "rgba(183,138,247,0.2)",
          }}
        >
          <div
            className="w-2 h-2 rounded-full animate-pulse"
            style={{ background: brandColor }}
          />
          <span className="text-[10px] font-black tracking-widest" style={{ color: brandColor }}>
            {mode} MODE
          </span>
        </div>
      </div>

      {/* Nav Section */}
      <nav className="flex-1 overflow-y-auto p-4 py-8">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-4 px-4 text-[#9586AE]">
          Main Navigation
        </p>
        <ul className="space-y-1.5">
          {navItems.map(({ href, icon: Icon, label, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link
                  href={href}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-300 relative group",
                    isActive
                      ? "text-white scale-[1.02]"
                      : "text-[#7B6E96] hover:text-white hover:bg-white/5"
                  )}
                  style={isActive ? {
                    background: mode === "MAINTAINER" ? "rgba(6,182,212,0.1)" : "rgba(183,138,247,0.1)",
                    borderLeft: `4px solid ${brandColor}`,
                    paddingLeft: "calc(1rem - 4px)"
                  } : {}}
                >
                  <Icon className={cn("w-5 h-5 flex-shrink-0 transition-transform group-hover:scale-110", isActive ? "text-white" : "text-current")} />
                  <span className="flex-1">{label}</span>
                  {isActive && (
                    <ChevronRight className="w-4 h-4 opacity-70" />
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Profile & Switcher Section */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        {organization && (
           <div className="px-3 py-3 rounded-xl mb-4 bg-white/5 border border-white/5">
              <p className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-1.5">Managing</p>
              <p className="text-sm text-white font-bold">{organization.name}</p>
              <p className="text-[10px] font-medium text-[#3B6E7A] mt-1">{organization.repos} repositories · {organization.members} members</p>
            </div>
        )}
        
        <Link
          href={switchModeHref}
          className="flex items-center gap-3 px-4 py-3 rounded-xl w-full text-xs font-black uppercase tracking-widest transition-all mb-4 hover:scale-[1.02]"
          style={{
            background: mode === "MAINTAINER" ? "rgba(124,58,237,0.1)" : "rgba(6,182,212,0.1)",
            border: `1px solid ${mode === "MAINTAINER" ? 'rgba(124,58,237,0.2)' : 'rgba(6,182,212,0.2)'}`,
            color: mode === "MAINTAINER" ? "#A78BFA" : "#67E8F9"
          }}
        >
          <ArrowLeftRight className="w-4 h-4" />
          <span className="flex-1">{switchModeLabel}</span>
        </Link>

        <div className="rounded-2xl p-4 flex items-center gap-3 bg-white/5 border border-white/5 shadow-inner">
          <div className="relative">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-black text-white shadow-xl"
              style={{ background: brandGradient || `linear-gradient(135deg, ${brandColor}, #000)` }}
            >
              {user.initials}
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3.5 h-3.5 rounded-full border-2 border-[#110E15] bg-[#4ADE80]" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white truncate">{user.name}</p>
            <p className="text-[10px] font-black tracking-widest" style={{ color: brandColor }}>
              {user.role || `${user.level} · ${user.xp}`}
            </p>
          </div>
          {user.streak && (
             <div className="text-[10px] font-black px-2 py-1 rounded-full bg-orange-500/20 text-orange-400 border border-orange-500/20">
               🔥 {user.streak}
             </div>
          )}
        </div>
      </div>
    </aside>
  );
}
