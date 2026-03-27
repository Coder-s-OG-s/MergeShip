"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, AlertTriangle, Users2, BarChart3, GitMerge, ChevronRight, ArrowLeftRight } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/maintainer", icon: LayoutDashboard, label: "Command Center", exact: true },
  { href: "/maintainer/triage", icon: AlertTriangle, label: "Issue Triage" },
  { href: "/maintainer/team", icon: Users2, label: "Team & Workload" },
  { href: "/maintainer/analytics", icon: BarChart3, label: "Analytics" },
];

export function MaintainerSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40"
      style={{ background: "linear-gradient(180deg, #050E14 0%, #030810 100%)", borderRight: "1px solid rgba(6,182,212,0.1)" }}>

      {/* Logo + mode label */}
      <div className="p-6 border-b" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
        <Link href="/" className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: "linear-gradient(135deg, #0E7490, #155E75)", boxShadow: "0 0 20px rgba(6,182,212,0.4)" }}>
            <GitMerge className="w-5 h-5 text-white" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-lg leading-none">MergeShip</p>
            <p className="text-xs mt-0.5" style={{ color: "#3B6E7A" }}>v0.1.0</p>
          </div>
        </Link>
        {/* Mode pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(6,182,212,0.12)", border: "1px solid rgba(6,182,212,0.3)" }}>
          <div className="w-2 h-2 rounded-full bg-cyan-400" />
          <span className="text-xs font-bold text-cyan-300">MAINTAINER MODE</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="text-xs font-semibold uppercase tracking-widest mb-3 px-3 text-cyan-500">Navigation</p>
        <ul className="space-y-1">
          {navItems.map(({ href, icon: Icon, label, exact }) => {
            const isActive = exact ? pathname === href : pathname.startsWith(href);
            return (
              <li key={href}>
                <Link href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive
                      ? "text-cyan-300 border-l-[3px] border-cyan-400 bg-cyan-400/10 pl-[calc(0.75rem-3px)]"
                      : "text-gray-400 hover:text-gray-200 hover:bg-white/5"
                  )}>
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  <span className="flex-1">{label}</span>
                  {isActive && <ChevronRight className="w-3 h-3 opacity-60" />}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Org info */}
      <div className="px-4 pb-2">
        <div className="px-3 py-3 rounded-xl" style={{ background: "rgba(6,182,212,0.06)", border: "1px solid rgba(6,182,212,0.12)" }}>
          <p className="text-xs font-semibold text-cyan-300 mb-1">Managing</p>
          <p className="text-sm text-white font-medium">vercel/*</p>
          <p className="text-xs" style={{ color: "#3B6E7A" }}>4 repositories · 4 members</p>
        </div>
      </div>

      {/* Switch to Contributor */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(6,182,212,0.1)" }}>
        <Link href="/dashboard"
          className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-sm font-medium transition-all mb-3"
          style={{ background: "rgba(124,58,237,0.08)", border: "1px solid rgba(124,58,237,0.2)", color: "#A78BFA" }}>
          <ArrowLeftRight className="w-4 h-4" />
          <span className="flex-1">Switch to Contributor</span>
        </Link>
        {/* User card */}
        <div className="rounded-xl p-3 flex items-center gap-3" style={{ background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.06)" }}>
          <div className="relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: "linear-gradient(135deg, #0E7490, #155E75)" }}>AC</div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-online" style={{ borderColor: "#030810" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">Alex Chen</p>
            <p className="text-xs" style={{ color: "#67E8F9" }}>Lead Maintainer</p>
          </div>
        </div>
      </div>
    </aside>
  );
}
