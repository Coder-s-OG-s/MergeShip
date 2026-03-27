"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Bell, Search, Hexagon, ArrowUp } from "lucide-react";

const navItems = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/issues", label: "Explore Issues" },
  { href: "/leaderboard", label: "Leaderboard" },
  { href: "/community", label: "Community" },
];

export default function ContributorLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col font-sans text-white" style={{ background: "#15111A" }}>
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-4 border-b border-white/5" style={{ background: "#15111A" }}>
        
        {/* Left side: Logo & Links */}
        <div className="flex items-center gap-10">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#D8B4FE", color: "#15111A" }}>
              <ArrowUp className="w-5 h-5 font-bold" />
            </div>
            <span className="font-display font-bold text-xl tracking-tight">MergeShip</span>
          </Link>
          
          <div className="hidden md:flex items-center gap-8">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link 
                  key={item.href} 
                  href={item.href}
                  className={`text-sm font-medium transition-colors relative py-5 -my-5 ${isActive ? 'text-white' : 'text-[#8B7E9F] hover:text-white'}`}
                >
                  {item.label}
                  {isActive && (
                    <div className="absolute bottom-0 left-0 w-full h-[2px]" style={{ background: "#D8B4FE" }} />
                  )}
                </Link>
              );
            })}
          </div>
        </div>

        {/* Right side: Search, Bell, Avatar */}
        <div className="flex items-center gap-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7E9F]" />
            <input 
              type="text" 
              placeholder="Find a repository..." 
              className="pl-10 pr-4 py-2 rounded-lg text-sm outline-none transition-all placeholder:text-[#8B7E9F] text-white focus:ring-1 focus:ring-[#D8B4FE]"
              style={{ background: "#1E1826", border: "1px solid rgba(255,255,255,0.05)" }}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 opacity-50">
              <span className="text-[10px] font-bold border border-white/20 rounded px-1 text-[#8B7E9F]">⌘K</span>
            </div>
          </div>
          
          <button className="w-9 h-9 flex items-center justify-center rounded-lg relative" style={{ background: "#1E1826" }}>
            <Bell className="w-4 h-4 text-[#8B7E9F]" />
            <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-red-500" />
          </button>
          
          <div className="w-9 h-9 flex items-center justify-center rounded-full text-xs font-bold" style={{ background: "#D8B4FE", color: "#15111A" }}>
            JD
          </div>
        </div>
      </nav>

      <main className="flex-1">
        {children}
      </main>

      {/* Basic keyframes mapped for internal elements */}
      <style dangerouslySetInnerHTML={{__html: `
        .badge-active { background: #2A2136; border: 1px solid rgba(216,180,254,0.2); }
      `}} />
    </div>
  );
}
