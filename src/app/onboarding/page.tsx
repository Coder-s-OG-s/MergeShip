"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { GitMerge, Bell, User, Rocket, Link as LinkIcon, Check, ArrowRight, Brain, TrendingUp, ShieldCheck, Mail, Globe, Users, Trophy, BarChart2, TerminalSquare, BookOpen, Layers, Lock } from "lucide-react";
import { useRouter } from "next/navigation";

type Step = "role_selection" | "connect" | "analyzing" | "assessment" | "course";

export default function OnboardingPage() {
  const [step, setStep] = useState<Step>("role_selection");
  const [role, setRole] = useState<"contributor" | "maintainer" | null>(null);
  const router = useRouter();
  
  // Simulate analyzing to assessment
  useEffect(() => {
    if (step === "analyzing") {
      const timer = setTimeout(() => {
        setStep("assessment");
      }, 3000); 
      return () => clearTimeout(timer);
    }
  }, [step]);

  // Handle GitHub connection simulation
  const handleConnect = () => {
    setStep("analyzing");
  };

  const handleRoleSelect = (selectedRole: "contributor" | "maintainer") => {
    setRole(selectedRole);
    if (selectedRole === "contributor") {
      setStep("connect");
    } else {
      alert("Maintainer onboarding UI will be provided later. You can proceed to the command center.");
      window.location.href = "/maintainer";
    }
  };

  const handleStartJourney = () => {
    setStep("course");
  };

  return (
    <div className="min-h-screen flex flex-col font-sans" style={{ background: "#15111A", color: "#F8F8FF" }}>
      {/* Top Navigation */}
      <nav className="flex items-center justify-between px-8 py-5 border-b border-white/5 bg-[#15111A] relative z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ background: "#D8B4FE", color: "#15111A" }}>
            <GitMerge className="w-5 h-5 font-bold" />
          </div>
          <span className="font-display font-bold text-xl tracking-tight text-white">MergeShip</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-9 h-9 flex items-center justify-center rounded-lg" style={{ background: "rgba(255,255,255,0.03)" }}>
            <Bell className="w-4 h-4 text-[#8B7E9F]" />
          </div>
          <div className="w-9 h-9 flex items-center justify-center rounded-full" style={{ background: "rgba(255,255,255,0.05)" }}>
            <User className="w-4 h-4 text-[#8B7E9F]" />
          </div>
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center py-16 px-6 relative">
        
        {/* Role Selection Step */}
        {step === "role_selection" && (
          <div className="w-full max-w-3xl animate-fade-in text-center mt-10">
            <h1 className="text-3xl font-display font-bold text-white mb-4">How do you want to use MergeShip?</h1>
            <p className="text-[#8B7E9F] mb-10">Select your primary role to customize your onboarding experience.</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <button 
                onClick={() => handleRoleSelect("contributor")}
                className="group p-8 rounded-2xl text-left transition-all duration-300 border border-white/5 hover:border-[#D8B4FE]/50 bg-[#1E1826]"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 bg-[#D8B4FE]/10 text-[#D8B4FE] group-hover:bg-[#D8B4FE] group-hover:text-[#15111A] transition-colors">
                  <Rocket className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">I am a Contributor</h2>
                <p className="text-sm text-[#8B7E9F] leading-relaxed">
                  I want to discover issues, level up my skills, build my portfolio, and get AI guidance on my open-source journey.
                </p>
              </button>

              <button 
                onClick={() => handleRoleSelect("maintainer")}
                className="group p-8 rounded-2xl text-left transition-all duration-300 border border-white/5 hover:border-[#38BDF8]/50 bg-[#1E1826]"
              >
                <div className="w-12 h-12 rounded-full flex items-center justify-center mb-6 bg-[#38BDF8]/10 text-[#38BDF8] group-hover:bg-[#38BDF8] group-hover:text-white transition-colors">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-xl font-bold text-white mb-2">I am a Maintainer</h2>
                <p className="text-sm text-[#8B7E9F] leading-relaxed">
                  I want to manage my repositories, auto-triage issues, balance team workloads, and grow my contributor community.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* Contributor Onboarding Flow - "Connect" Full Page Intro */}
        {step === "connect" && (
          <div className="w-full max-w-4xl mx-auto flex flex-col items-center animate-fade-in relative pb-10">
            {/* Very faint background vertical line connecting the 3 sections */}
            <div className="absolute left-1/2 top-10 bottom-40 w-px bg-white/5 -translate-x-1/2 z-0 hidden md:block" />

            {/* Section 1: What is Open Source? */}
            <div className="text-center relative z-10 w-full mb-32 bg-[#15111A] pt-4">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-[#2A2136] text-[#D8B4FE] mb-6">
                <Globe className="w-7 h-7" />
              </div>
              <h1 className="text-3xl font-display font-bold text-white mb-5">What is Open Source?</h1>
              <p className="max-w-2xl mx-auto text-[#8B7E9F] text-[15px] leading-relaxed mb-12">
                Open source is more than just code. It's a global community of developers collaborating to build the foundation of the modern internet. By contributing, you don't just write software—you solve real-world problems alongside the best engineers in the world.
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[#1E1826] border border-white/5 p-8 rounded-2xl">
                  <Users className="w-6 h-6 text-[#D8B4FE] mx-auto mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">Community</h3>
                  <p className="text-[13px] text-[#8B7E9F]">Learn from mentors and build your network.</p>
                </div>
                <div className="bg-[#1E1826] border border-white/5 p-8 rounded-2xl">
                  <TrendingUp className="w-6 h-6 text-[#D8B4FE] mx-auto mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">Skill Growth</h3>
                  <p className="text-[13px] text-[#8B7E9F]">Work on production-grade codebases.</p>
                </div>
                <div className="bg-[#1E1826] border border-white/5 p-8 rounded-2xl">
                  <Check className="w-6 h-6 text-[#D8B4FE] mx-auto mb-4" />
                  <h3 className="text-sm font-bold text-white mb-2">Recognition</h3>
                  <p className="text-[13px] text-[#8B7E9F]">Build a verifiable portfolio of work.</p>
                </div>
              </div>
            </div>

            {/* Section 2: Data-Driven Path */}
            <div className="text-center relative z-10 w-full mb-32 bg-[#15111A] py-4">
              <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center bg-[#2A2136] text-[#D8B4FE] mb-6">
                <BarChart2 className="w-7 h-7" />
              </div>
              <h2 className="text-3xl font-display font-bold text-white mb-5">Your Path, Data-Driven</h2>
              <p className="max-w-2xl mx-auto text-[#8B7E9F] text-[15px] leading-relaxed mb-12">
                Every developer has a unique journey. MergeShip uses advanced analysis of your GitHub activity—your commits, pull requests, and languages—to map out your current expertise and identify exactly where you can make the biggest impact.
              </p>

              <div className="bg-[#15111A] border-2 border-dashed border-[#2A2136] rounded-3xl p-10 max-w-3xl mx-auto flex flex-col items-center">
                <div className="flex items-center justify-center gap-12 mb-8">
                  <div className="text-center">
                    <TerminalSquare className="w-6 h-6 text-[#8B7E9F] mx-auto mb-2" />
                    <span className="text-[10px] font-bold tracking-widest text-[#8B7E9F]">COMMITS</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8B7E9F]/40" />
                  <div className="text-center">
                    <Layers className="w-6 h-6 text-[#D8B4FE] mx-auto mb-2" />
                    <span className="text-[10px] font-bold tracking-widest text-[#D8B4FE]">REPOS</span>
                  </div>
                  <div className="w-1.5 h-1.5 rounded-full bg-[#8B7E9F]/40" />
                  <div className="text-center">
                    <BookOpen className="w-6 h-6 text-[#8B7E9F] mx-auto mb-2" />
                    <span className="text-[10px] font-bold tracking-widest text-[#8B7E9F]">LANGUAGES</span>
                  </div>
                </div>
                <p className="text-sm italic text-[#8B7E9F]">"We analyze the past to help you architect your future."</p>
              </div>
            </div>

            {/* Section 3: Connect Account */}
            <div className="text-center relative z-10 w-full flex flex-col items-center">
              <div className="bg-[#1E1826] border border-white/5 rounded-[2rem] p-12 w-full max-w-2xl shadow-2xl relative overflow-hidden">
                {/* Subtle glow bg */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-[#D8B4FE]/10 rounded-full blur-[80px]" />
                
                <div className="relative z-10">
                  <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center bg-[#D8B4FE] text-[#15111A] mb-8 shadow-[0_0_30px_rgba(216,180,254,0.3)]">
                    <Rocket className="w-7 h-7" />
                  </div>
                  <h2 className="text-3xl font-display font-bold text-white mb-4">Ready to start your journey?</h2>
                  <p className="text-[15px] mb-10 max-w-md mx-auto" style={{ color: "#8B7E9F" }}>
                    Connect your GitHub account to unlock your personalized learning paths and begin your transformation into a high-impact open source contributor.
                  </p>
                  
                  <button 
                    onClick={handleConnect}
                    className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-bold text-[15px] transition-all hover:scale-105"
                    style={{ background: "#4ADE80", color: "#062A15" }}
                  >
                    <LinkIcon className="w-5 h-5" />
                    Connect GitHub Account
                  </button>
                  <p className="text-xs text-[#8B7E9F] mt-6 flex items-center justify-center gap-1.5">
                    <Lock className="w-3 h-3" /> We only request read-only access to your public profile.
                  </p>
                </div>
              </div>

              <Link href="/dashboard" className="text-[11px] font-bold tracking-widest text-[#8B7E9F] mt-10 hover:text-white transition-colors flex items-center gap-2">
                BROWSE PATHS WITHOUT DATA ANALYSIS <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>
        )}

        {/* Post-Connection Sequence (Analyzing & Assessment) */}
        {(step === "analyzing" || step === "assessment") && (
          <div className="w-full max-w-3xl relative">
            <div className="absolute left-[7px] top-[30px] bottom-10 w-[2px]" style={{ background: "#2A2136" }} />

            {/* Step: Analyzing */}
            <div className="relative pl-12 mb-12 animate-fade-in">
              <div className="absolute left-0 top-[28px] w-4 h-4 rounded-full border-4 border-[#15111A]" style={{ background: step === "assessment" ? "#D8B4FE" : "#605375" }} />
              
              <div className="p-10 rounded-2xl text-center border bg-[#1E1826] border-white/5 shadow-2xl">
                <div className="w-14 h-14 mx-auto rounded-full flex items-center justify-center mb-5 border-2 border-white/10" style={{ background: "rgba(255,255,255,0.02)", color: "#8B7E9F" }}>
                  <User className="w-6 h-6" />
                </div>
                <h3 className="text-lg font-bold text-white mb-2" style={{ color: "#D8B4FE" }}>
                  {step === "analyzing" ? "Analyzing commit patterns..." : "Analysis Complete"}
                </h3>
                <p className="text-xs mb-6" style={{ color: "#8B7E9F" }}>
                  {step === "analyzing" ? "Retrieving repository data and contribution graphs" : "Your GitHub profile has been successfully evaluated."}
                </p>
                
                <div className="w-64 max-w-full mx-auto h-1.5 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.05)" }}>
                  <div 
                    className="h-full rounded-full transition-all duration-[3000ms] ease-out"
                    style={{ 
                      width: "100%", 
                      background: "linear-gradient(90deg, #9333EA, #D8B4FE)",
                      transformOrigin: "left",
                      animation: step === "analyzing" ? "pulse-bar 1.5s infinite" : "none"
                    }} 
                  />
                </div>
              </div>
            </div>

            {/* Step: Assessment & Paths */}
            {step === "assessment" && (
              <div className="relative pl-12 animate-fade-in duration-700">
                <div className="absolute left-0 top-[28px] w-4 h-4 rounded-full border-4 border-[#15111A]" style={{ background: "#D8B4FE" }} />
                
                {/* Score Card */}
                <div className="p-6 rounded-2xl border bg-[#1E1826] border-white/5 shadow-2xl mb-8 flex flex-col md:flex-row items-center gap-8">
                  <div className="relative w-24 h-24 flex-shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
                      <circle cx="18" cy="18" r="15" fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="3.5" />
                      <circle cx="18" cy="18" r="15" fill="none" stroke="#D8B4FE" strokeWidth="3.5" strokeDasharray="73.32 94.24" strokeLinecap="round" />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center">
                      <span className="text-2xl font-bold leading-none text-white">78</span>
                      <span className="text-[9px] font-bold tracking-wider" style={{ color: "#8B7E9F" }}>SCORE</span>
                    </div>
                  </div>

                  <div className="flex-1 w-full">
                    <div className="flex justify-between items-start mb-6 w-full">
                      <div>
                        <h3 className="text-xl font-bold text-white mb-1">Assessment Complete</h3>
                        <p className="text-xs" style={{ color: "#8B7E9F" }}>Based on your activity in the last 12 months</p>
                      </div>
                      <span className="px-3 py-1 text-xs font-bold rounded-full" style={{ background: "rgba(216,180,254,0.15)", border: "1px solid rgba(216,180,254,0.3)", color: "#D8B4FE" }}>
                        INTERMEDIATE
                      </span>
                    </div>
                    {/* Stats */}
                    <div className="grid grid-cols-2 gap-x-8 gap-y-4">
                      <div>
                        <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#8B7E9F" }}>
                          <span>ACCOUNT AGE</span> <span className="text-white">2.4 YEARS</span>
                        </div>
                        <div className="h-1 rounded-full w-full bg-white/5"><div className="h-full rounded-full bg-[#38BDF8] w-[40%]" /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#8B7E9F" }}>
                          <span>REPO COUNT</span> <span className="text-[#F472B6]">14 REPOS</span>
                        </div>
                        <div className="h-1 rounded-full w-full bg-white/5"><div className="h-full rounded-full bg-[#F472B6] w-[60%]" /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#8B7E9F" }}>
                          <span>COMMITS</span> <span className="text-[#FBBF24]">412 COMMITS</span>
                        </div>
                        <div className="h-1 rounded-full w-full bg-white/5"><div className="h-full rounded-full bg-[#FBBF24] w-[75%]" /></div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[10px] font-bold tracking-widest mb-1.5" style={{ color: "#8B7E9F" }}>
                          <span>PR ACCEPTANCE</span> <span className="text-[#4ADE80]">92%</span>
                        </div>
                        <div className="h-1 rounded-full w-full bg-white/5"><div className="h-full rounded-full bg-[#4ADE80] w-[92%]" /></div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mb-4 flex items-center gap-2">
                  <div className="text-[#D8B4FE]"><Check className="w-4 h-4" /></div>
                  <h4 className="text-[11px] font-bold tracking-widest" style={{ color: "#D8B4FE" }}>RECOMMENDED LEARNING PATHS</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-10">
                  <div onClick={handleStartJourney} className="cursor-pointer p-6 rounded-2xl border bg-[#1E1826] border-white/5 shadow-lg relative group transition-all hover:bg-[#2A2136] hover:border-[#D8B4FE]/30">
                    <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center bg-white/5 text-[#D8B4FE]"><Brain className="w-4 h-4" /></div>
                    <h5 className="font-bold text-white text-sm mb-2">Advanced Node.js Architectures</h5>
                    <p className="text-xs leading-relaxed" style={{ color: "#8B7E9F" }}>Deep dive into streams, buffers, and system-level interactions based on your current repo patterns.</p>
                  </div>
                  <div onClick={handleStartJourney} className="cursor-pointer p-6 rounded-2xl border bg-[#1E1826] border-white/5 shadow-lg relative group transition-all hover:bg-[#2A2136] hover:border-[#D8B4FE]/30">
                    <div className="w-8 h-8 rounded-lg mb-4 flex items-center justify-center bg-white/5 text-[#38BDF8]"><TrendingUp className="w-4 h-4" /></div>
                    <h5 className="font-bold text-white text-sm mb-2">Infrastructure as Code (Terraform)</h5>
                    <p className="text-xs leading-relaxed" style={{ color: "#8B7E9F" }}>Scale your knowledge into cloud orchestration. We noticed you use AWS frequently.</p>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Level Unlocked & Course Explanation Step */}
        {step === "course" && (
          <div className="w-full max-w-2xl mx-auto flex flex-col items-center animate-fade-in text-center mt-10">
            {/* Celebration Badge */}
            <div className="relative mb-10 group">
              <div className="absolute inset-0 bg-[#D8B4FE] blur-[50px] opacity-20 group-hover:opacity-40 transition-opacity duration-1000" />
              <div className="w-32 h-32 rounded-[2rem] bg-gradient-to-br from-[#1E1826] to-[#15111A] border-2 border-[#D8B4FE]/30 flex flex-col items-center justify-center relative z-10 shadow-2xl rotate-3">
                <Trophy className="w-10 h-10 text-[#FBBF24] mb-2" />
                <span className="font-display font-bold text-white text-xl">Level 3</span>
                <span className="text-[10px] font-bold text-[#D8B4FE] tracking-widest mt-1">UNLOCKED</span>
              </div>
            </div>

            <h1 className="text-3xl font-display font-bold text-white mb-6">Welcome to Your Open-Source Journey</h1>
            
            {/* The "Course" explanation */}
            <div className="bg-[#1E1826] border border-white/5 rounded-3xl p-8 text-left mb-10 w-full relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#D8B4FE]/5 rounded-bl-full" />
              <p className="text-[#8B7E9F] text-[15px] leading-relaxed mb-6 relative z-10">
                Based on your GitHub history, we've placed you at <strong className="text-white">Level 3 (Intermediate)</strong>. Here is how MergeShip works:
              </p>
              <ul className="space-y-4 relative z-10">
                <li className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D8B4FE]/10 flex items-center justify-center flex-shrink-0 text-[#D8B4FE]">1</div>
                  <p className="text-[14px] text-[#8B7E9F] leading-relaxed"><strong className="text-white">Clear the Board.</strong> On your dashboard, you'll find issues sorted by difficulty (Easy, Standard, Elite). Only take what you can handle.</p>
                </li>
                <li className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D8B4FE]/10 flex items-center justify-center flex-shrink-0 text-[#D8B4FE]">2</div>
                  <p className="text-[14px] text-[#8B7E9F] leading-relaxed"><strong className="text-white">Earn XP & Badges.</strong> Every merged PR gives you XP. Level up to unlock harder issues and gain the trust of maintainers.</p>
                </li>
                <li className="flex gap-4">
                  <div className="w-8 h-8 rounded-full bg-[#D8B4FE]/10 flex items-center justify-center flex-shrink-0 text-[#D8B4FE]">3</div>
                  <p className="text-[14px] text-[#8B7E9F] leading-relaxed"><strong className="text-white">Level Up.</strong> Hit Level 5 to unlock Mentoship, Pro Badges, and direct lines to top open-source teams.</p>
                </li>
              </ul>
            </div>

            <button 
              onClick={() => router.push("/dashboard")}
              className="inline-flex items-center gap-3 px-10 py-4 rounded-xl font-bold text-[15px] transition-all hover:scale-105 shadow-[0_0_30px_rgba(216,180,254,0.15)]"
              style={{ background: "#D8B4FE", color: "#15111A" }}
            >
              Start Contributing <Rocket className="w-5 h-5" />
            </button>
          </div>
        )}

      </main>

      {/* Footer */}
      {step !== "course" && (
        <footer className="py-8 border-t border-white/5 text-center flex flex-col items-center pb-12 mt-auto">
          <div className="flex items-center gap-6 mb-4 text-[10px] font-bold tracking-widest" style={{ color: "#8B7E9F" }}>
            <a href="#" className="hover:text-white transition-colors">DOCUMENTATION</a>
            <a href="#" className="hover:text-white transition-colors">DISCORD COMMUNITY</a>
            <a href="#" className="hover:text-white transition-colors">SUPPORT</a>
          </div>
          <p className="text-[10px] tracking-widest" style={{ color: "#4B405A" }}>© 2024 MERGESHIP. ALL RIGHTS RESERVED.</p>
        </footer>
      )}

      {/* Animations */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes fade-in {
          0% { opacity: 0; transform: translateY(15px); }
          100% { opacity: 1; transform: translateY(0); }
        }
        .animate-fade-in {
          animation: fade-in 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes pulse-bar {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
      `}} />
    </div>
  );
}
