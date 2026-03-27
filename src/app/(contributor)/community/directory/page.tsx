"use client";

import { ArrowLeft, Search, Filter, Code2, Users, Cpu, Shield, Globe, Terminal, Box, Cloud } from "lucide-react";
import Link from "next/link";
import { useState } from "react";

const CATEGORIES = ["All Guilds", "Languages", "Frameworks", "Infrastructure", "Domain Experts"];

export default function GuildDirectoryPage() {
  const [activeCategory, setActiveCategory] = useState("All Guilds");

  const guilds = [
    { id: "react-performance", name: "React Performance", desc: "Concurrent rendering and memoization bugs in major frameworks.", icon: Code2, color: "blue", tags: ["Frameworks", "Intermediate"], members: 142 },
    { id: "rust-systems", name: "Rust Systems", desc: "Tackling memory safety and ownership issues via standard quests.", icon: Terminal, color: "orange", tags: ["Languages", "Intermediate"], members: 89 },
    { id: "go-microservices", name: "Go Microservices", desc: "Scaling distributed systems and network bottlenecks.", icon: Cloud, color: "cyan", tags: ["Infrastructure", "Advanced"], members: 215 },
    { id: "web-accessibility", name: "A11y Champions", desc: "Making the open web accessible. High impact UI/UX fixes.", icon: Globe, color: "emerald", tags: ["Domain Experts", "Beginner"], members: 340 },
    { id: "ml-ops", name: "ML Ops & Pipelines", desc: "Optimizing tensor operations and model deployment pipelines.", icon: Cpu, color: "purple", tags: ["Domain Experts", "Advanced"], members: 67 },
    { id: "security-auditors", name: "Security Auditors", desc: "Finding and patching CVEs before they hit production.", icon: Shield, color: "red", tags: ["Domain Experts", "Master"], members: 42 },
    { id: "docker-k8s", name: "Container Masters", desc: "Kubernetes operators and Docker compose wizardry.", icon: Box, color: "blue", tags: ["Infrastructure", "Advanced"], members: 128 },
    { id: "python-beginners", name: "Python First Steps", desc: "The perfect place to land your very first open source PR.", icon: Terminal, color: "yellow", tags: ["Languages", "Beginner"], members: 890 },
  ];

  const filtered = activeCategory === "All Guilds" 
    ? guilds 
    : guilds.filter(g => g.tags.includes(activeCategory));

  return (
    <div className="max-w-[1400px] mx-auto p-8 font-sans">
      
      {/* Back Navigation */}
      <Link href="/community" className="inline-flex items-center gap-2 text-sm font-bold text-[#8B7E9F] hover:text-white transition-colors mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Hub
      </Link>

      {/* Header */}
      <div className="mb-10">
        <h1 className="text-3xl font-display font-bold text-white mb-3">Guild Directory</h1>
        <p className="text-[#8B7E9F] max-w-2xl">Browse and join specialized task forces across the open-source ecosystem. Guilds help you focus your learning and find co-contributors for complex issues.</p>
      </div>

      {/* Search and Filters */}
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center mb-10">
        <div className="relative w-full md:w-96">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-[#8B7E9F]" />
          <input 
            type="text" 
            placeholder="Search guilds by name or skill..." 
            className="w-full bg-[#1E1826] border border-white/10 rounded-xl py-3 pl-11 pr-4 text-sm text-white focus:outline-none focus:border-[#D8B4FE]/50 transition-colors"
          />
        </div>
        
        <div className="flex items-center gap-2 overflow-x-auto pb-2 md:pb-0 w-full md:w-auto hide-scrollbar">
          {CATEGORIES.map(cat => (
            <button 
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`whitespace-nowrap px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${
                activeCategory === cat 
                  ? "bg-[#D8B4FE] text-[#15111A] shadow-[0_0_15px_rgba(216,180,254,0.3)]" 
                  : "bg-[#1E1826] border border-white/5 text-[#8B7E9F] hover:text-white hover:border-white/20"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {filtered.map(guild => {
          const Icon = guild.icon;
          // Simple color mapping
          const colors: Record<string, { bg: string, text: string, hover: string }> = {
            blue: { bg: "bg-blue-500/10", text: "text-blue-400", hover: "hover:border-blue-500/30" },
            orange: { bg: "bg-orange-500/10", text: "text-orange-400", hover: "hover:border-orange-500/30" },
            cyan: { bg: "bg-cyan-500/10", text: "text-cyan-400", hover: "hover:border-cyan-500/30" },
            emerald: { bg: "bg-emerald-500/10", text: "text-emerald-400", hover: "hover:border-emerald-500/30" },
            purple: { bg: "bg-purple-500/10", text: "text-purple-400", hover: "hover:border-purple-500/30" },
            red: { bg: "bg-red-500/10", text: "text-red-400", hover: "hover:border-red-500/30" },
            yellow: { bg: "bg-yellow-500/10", text: "text-yellow-400", hover: "hover:border-yellow-500/30" },
          };
          const theme = colors[guild.color];

          return (
            <Link href={`/community/${guild.id}`} key={guild.id} className={`bg-[#1E1826] border border-white/5 rounded-2xl p-6 ${theme.hover} transition-all group flex flex-col h-full`}>
               <div className="flex justify-between items-start mb-5">
                  <div className={`w-12 h-12 rounded-xl ${theme.bg} flex items-center justify-center ${theme.text}`}>
                    <Icon className="w-6 h-6" />
                  </div>
                  <span className="flex items-center gap-1.5 text-[10px] font-bold px-2 py-1 rounded bg-[#15111A] border border-white/5 text-[#8B7E9F]">
                    <Users className="w-3 h-3" /> {guild.members}
                  </span>
                </div>
                
                <h3 className="font-bold text-white text-lg mb-2 group-hover:text-white transition-colors">{guild.name}</h3>
                <p className="text-[13px] text-[#8B7E9F] leading-relaxed mb-6 flex-1">{guild.desc}</p>
                
                <div className="flex flex-wrap gap-2 mt-auto">
                    {guild.tags.map(tag => (
                      <span key={tag} className="text-[9px] font-bold uppercase tracking-widest px-2 py-1 rounded bg-white/5 text-[#8B7E9F]">
                        {tag}
                      </span>
                    ))}
                </div>
            </Link>
          );
        })}
      </div>

    </div>
  );
}
