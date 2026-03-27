"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, Zap, Trophy, User, UsersRound, GitMerge, ChevronRight, ArrowLeftRight } from "lucide-react";
import { clsx } from "clsx";

const navItems = [
  { href: "/dashboard", icon: LayoutDashboard, label: "Dashboard" },
  { href: "/issues", icon: Zap, label: "Issue Feed" },
  { href: "/achievements", icon: Trophy, label: "Achievements" },
  { href: "/portfolio", icon: User, label: "My Portfolio" },
  { href: "/community", icon: UsersRound, label: "Community" },
];

export function ContributorSidebar() {
  const pathname = usePathname();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40"
      style={{ background: "#110E15", borderRight: "1px solid rgba(255,255,255,0.05)" }}>

      {/* Logo + mode label */}
      <div className="p-6 border-b" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Link href="/" className="flex items-center gap-3 mb-4">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-purple"
            style={{ background: "#B78AF7", color: "#110E15" }}>
            <GitMerge className="w-5 h-5 font-bold text-[#110E15]" />
          </div>
          <div>
            <p className="font-display font-bold text-white text-lg leading-none">MergeShip</p>
            <p className="text-xs mt-0.5" style={{ color: "#606080" }}>v0.1.0</p>
          </div>
        </Link>
        {/* Mode pill */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg" style={{ background: "rgba(183,138,247,0.1)", border: "1px solid rgba(183,138,247,0.2)" }}>
          <div className="w-2 h-2 rounded-full" style={{ background: "#B78AF7" }} />
          <span className="text-xs font-bold" style={{ color: "#B78AF7" }}>CONTRIBUTOR MODE</span>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest mb-3 px-3" style={{ color: "#9586AE" }}>Navigation</p>
        <ul className="space-y-1">
          {navItems.map(({ href, icon: Icon, label }) => {
            const isActive = pathname === href || (href !== "/" && href !== "/community" && pathname.startsWith(href)) || (href === "/community" && pathname.startsWith("/community"));
            return (
              <li key={href}>
                <Link href={href}
                  className={clsx(
                    "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-200",
                    isActive 
                      ? "text-[#B78AF7] bg-[rgba(183,138,247,0.1)] border border-[rgba(183,138,247,0.2)]" 
                      : "text-[#7B6E96] hover:text-white hover:bg-white/5"
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

      {/* Switch to Maintainer */}
      <div className="p-4 border-t" style={{ borderColor: "rgba(255,255,255,0.05)" }}>
        <Link href="/maintainer"
          className="flex items-center gap-3 px-3 py-3 rounded-xl w-full text-sm font-medium transition-all mb-3 hover:bg-[#201B28]"
          style={{ border: "1px solid rgba(255,255,255,0.05)", color: "#7B6E96" }}>
          <ArrowLeftRight className="w-4 h-4" />
          <span className="flex-1">Switch to Maintainer</span>
        </Link>
        {/* User card */}
        <div className="rounded-xl p-3 flex items-center gap-3 border" style={{ background: "#1C1722", borderColor: "rgba(255,255,255,0.05)" }}>
          <div className="relative">
            <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white level-badge">SS</div>
            <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 status-online" style={{ borderColor: "#0D0D1A" }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate">soumyasagar</p>
            <p className="text-xs" style={{ color: "#A78BFA" }}>L3 · 420 XP</p>
          </div>
          <div className="text-xs px-2 py-1 rounded-full" style={{ background: "rgba(124,58,237,0.2)", color: "#A78BFA", border: "1px solid rgba(124,58,237,0.3)" }}>🔥 7</div>
        </div>
      </div>
    </aside>
  );
}
