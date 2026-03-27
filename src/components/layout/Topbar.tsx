"use client";
import { Bell, Search, GitMerge } from "lucide-react";

export function Topbar({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-6"
      style={{
        background: "rgba(6,6,17,0.85)",
        borderBottom: "1px solid rgba(255,255,255,0.06)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
      }}>
      <div>
        <h1 className="text-lg font-display font-700 text-white">{title}</h1>
        {subtitle && <p className="text-xs" style={{ color: "#606080" }}>{subtitle}</p>}
      </div>

      <div className="flex items-center gap-3">
        {/* Search */}
        <div className="hidden md:flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
          style={{ background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.08)", color: "#606080" }}>
          <Search className="w-3.5 h-3.5" />
          <span>Search issues...</span>
          <kbd className="ml-2 text-xs px-1.5 py-0.5 rounded" style={{ background: "rgba(255,255,255,0.08)", color: "#505070" }}>⌘K</kbd>
        </div>

        {/* Notifications */}
        <button className="relative w-9 h-9 flex items-center justify-center rounded-lg transition-colors hover:bg-white/5"
          style={{ border: "1px solid rgba(255,255,255,0.08)" }}>
          <Bell className="w-4 h-4 text-gray-400" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full"
            style={{ background: "#7C3AED", boxShadow: "0 0 6px rgba(124,58,237,0.8)" }} />
        </button>

        {/* Avatar */}
        <div className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold text-white level-badge cursor-pointer">
          SS
        </div>
      </div>
    </header>
  );
}
