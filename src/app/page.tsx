import Link from "next/link";
import { GitMerge, Zap, Shield, Users, ArrowRight, Star, TrendingUp, CheckCircle } from "lucide-react";

import AuthStatus from "@/components/auth/AuthStatus";

export default function HomePage() {
  return (
    <div className="min-h-screen hero-bg grid-bg overflow-hidden">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl flex items-center justify-center glow-purple" style={{ background: "linear-gradient(135deg,#7C3AED,#5B21B6)" }}>
            <GitMerge className="w-5 h-5 text-white" />
          </div>
          <span className="font-display font-bold text-xl text-white">MergeShip</span>
        </div>
        <div className="flex items-center gap-4">
          <Link href="/onboarding" className="text-sm text-gray-400 hover:text-white transition-colors">For Contributors</Link>
          <Link href="/onboarding" className="text-sm text-gray-400 hover:text-white transition-colors">For Maintainers</Link>
          <Link href="/community" className="text-sm text-gray-400 hover:text-white transition-colors">Community</Link>
          <AuthStatus />
        </div>
      </nav>

      {/* Hero */}
      <section className="text-center px-6 pt-24 pb-20">
        <div className="mb-6">
          <span className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium"
            style={{ background: "rgba(124,58,237,0.15)", border: "1px solid rgba(124,58,237,0.3)", color: "#A78BFA" }}>
            <Star className="w-3.5 h-3.5" />
            Now in Public Beta — Join 1,000+ contributors
          </span>
        </div>

        <h1 className="font-display text-6xl md:text-7xl font-black mb-6 leading-none tracking-tight">
          <span className="text-white">Open Source,</span><br />
          <span className="gradient-text">Leveled Up</span>
        </h1>

        <p className="text-xl max-w-2xl mx-auto mb-10" style={{ color: "#A0A0C0" }}>
          MergeShip trains contributors to be ready before they submit, and organizes maintainer data so efficiently that a <strong className="text-white">12-hour workday becomes a 3-hour one.</strong>
        </p>

        <div className="flex items-center justify-center gap-4 flex-wrap">
          <Link href="/onboarding"
            className="btn-primary flex items-center gap-2 px-8 py-3.5 rounded-xl text-base font-semibold">
            Start Contributing
            <ArrowRight className="w-4 h-4" />
          </Link>
          <Link href="/onboarding"
            className="btn-secondary flex items-center gap-2 px-8 py-3.5 rounded-xl text-base">
            Maintainer Onboarding
          </Link>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-center gap-8 mt-14 flex-wrap">
          {[
            { number: "1,247", label: "Active Contributors" },
            { number: "38", label: "Organizations" },
            { number: "12,500+", label: "Issues Triaged" },
            { number: "92%", label: "PR Success Rate" },
          ].map(stat => (
            <div key={stat.label} className="text-center">
              <p className="stat-number text-3xl">{stat.number}</p>
              <p className="text-sm mt-1" style={{ color: "#606080" }}>{stat.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Feature Cards */}
      <section className="px-8 pb-24 max-w-6xl mx-auto">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {/* Contributor */}
          <div className="glass-card rounded-2xl p-7 transition-card group">
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg,rgba(124,58,237,0.3),rgba(124,58,237,0.1))", border: "1px solid rgba(124,58,237,0.3)" }}>
              <Zap className="w-6 h-6 text-purple-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-3">Contributor Portal</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#A0A0C0" }}>
              Level-by-level issue unlocking, XP rewards, daily curated feeds, achievement badges, and a verified public portfolio.
            </p>
            <ul className="space-y-2 mb-6">
              {["AI skill assessment", "Gamified XP system", "Mentorship buddy system", "Public dev portfolio"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#A0A0C0" }}>
                  <CheckCircle className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/dashboard" className="flex items-center gap-1 text-sm font-medium text-purple-400 hover:text-purple-300 transition-colors">
              Explore Dashboard <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Maintainer */}
          <div className="glass-card rounded-2xl p-7 transition-card group" style={{ borderColor: "rgba(6,182,212,0.2)" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg,rgba(6,182,212,0.3),rgba(6,182,212,0.1))", border: "1px solid rgba(6,182,212,0.3)" }}>
              <Shield className="w-6 h-6 text-cyan-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-3">Maintainer Command Center</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#A0A0C0" }}>
              Auto-triage, duplicate detection, stale issue surfacing, team workload balancing, and smart PR queue ranking.
            </p>
            <ul className="space-y-2 mb-6">
              {["Auto issue triage", "Duplicate detector", "Workload balancer", "Health analytics"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#A0A0C0" }}>
                  <CheckCircle className="w-3.5 h-3.5 text-cyan-400 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/maintainer" className="flex items-center gap-1 text-sm font-medium text-cyan-400 hover:text-cyan-300 transition-colors">
              Open Command Center <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {/* Community */}
          <div className="glass-card rounded-2xl p-7 transition-card group" style={{ borderColor: "rgba(236,72,153,0.2)" }}>
            <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-5"
              style={{ background: "linear-gradient(135deg,rgba(236,72,153,0.3),rgba(236,72,153,0.1))", border: "1px solid rgba(236,72,153,0.3)" }}>
              <Users className="w-6 h-6 text-pink-400" />
            </div>
            <h2 className="font-display text-xl font-bold text-white mb-3">Community Groups</h2>
            <p className="text-sm leading-relaxed mb-5" style={{ color: "#A0A0C0" }}>
              Skill-based micro-communities (max 50), weekly group challenges, buddy system, and mentor integration.
            </p>
            <ul className="space-y-2 mb-6">
              {["Skill-based matching", "Weekly challenges", "Buddy system", "Mentor access"].map(f => (
                <li key={f} className="flex items-center gap-2 text-sm" style={{ color: "#A0A0C0" }}>
                  <CheckCircle className="w-3.5 h-3.5 text-pink-400 flex-shrink-0" />{f}
                </li>
              ))}
            </ul>
            <Link href="/community" className="flex items-center gap-1 text-sm font-medium text-pink-400 hover:text-pink-300 transition-colors">
              Join a Group <ArrowRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </section>

      {/* Competitive table */}
      <section className="px-8 pb-24 max-w-4xl mx-auto">
        <h2 className="font-display text-3xl font-bold text-center text-white mb-3">
          What Nobody Else Has
        </h2>
        <p className="text-center mb-10" style={{ color: "#A0A0C0" }}>Features unique to MergeShip that no competitor offers</p>
        <div className="glass-card rounded-2xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                <th className="text-left p-4 text-gray-400 font-medium">Feature</th>
                <th className="text-center p-4 font-display font-bold" style={{ color: "#A78BFA" }}>MergeShip</th>
                <th className="text-center p-4 text-gray-500 font-medium">Everyone Else</th>
              </tr>
            </thead>
            <tbody>
              {[
                "Level-by-level issue unlocking",
                "Cohort-style guided learning",
                "Contributor Trust Score on PRs",
                "Duplicate Issue Auto-Detection",
                "Stale Issue Auto-Surfacing",
                "Smart PR Queue by quality",
                "Unified contributor + maintainer",
                "Mentorship Buddy System",
              ].map((feature, i) => (
                <tr key={feature} style={{ borderBottom: i < 7 ? "1px solid rgba(255,255,255,0.04)" : "none" }}>
                  <td className="p-4 text-gray-300">{feature}</td>
                  <td className="text-center p-4 text-green-400 text-base">✅</td>
                  <td className="text-center p-4 text-red-400 text-base">❌</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t px-8 py-8 text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <p className="text-sm" style={{ color: "#606080" }}>
          © 2026 MergeShip — <span className="gradient-text font-medium">Open Source, Leveled Up</span>
        </p>
      </footer>
    </div>
  );
}
