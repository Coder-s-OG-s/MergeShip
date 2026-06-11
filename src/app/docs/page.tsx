'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Menu, X, ArrowRight } from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import '@/app/landing.css';
import './docs.css';

type NavUser = { name: string | null; email: string | null };

function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.includes('127.0.0.1') || url.includes('localhost');
}

export default function DocsPage() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [user, setUser] = useState<NavUser | null>(null);
  const [configured, setConfigured] = useState(true);
  const localDev = isLocalSupabase();

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20);
    fn();
    window.addEventListener('scroll', fn, { passive: true });
    return () => window.removeEventListener('scroll', fn);
  }, []);

  useEffect(() => {
    document.body.style.overflow = menuOpen ? 'hidden' : '';
    return () => {
      document.body.style.overflow = '';
    };
  }, [menuOpen]);

  useEffect(() => {
    const sb = getBrowserSupabase();
    if (!sb) {
      setConfigured(false);
      return;
    }
    sb.auth.getUser().then(({ data }) => {
      if (!data.user) return setUser(null);
      const u = data.user;
      const meta = (u.user_metadata ?? {}) as Record<string, unknown>;
      const name =
        (meta['name'] as string | undefined) ??
        (meta['user_name'] as string | undefined) ??
        null;
      setUser({ name, email: u.email ?? null });
    });
  }, []);

  const handleLogin = () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    void sb.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=/dashboard`,
      },
    });
  };

  const handleLogout = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
  };

  const PrimaryCTA = ({ label, className = 'btn-neon' }: { label: string; className?: string }) => {
    if (user) {
      return (
        <Link href="/dashboard" className={className}>
          {label} <ArrowRight size={15} />
        </Link>
      );
    }
    if (localDev) {
      return (
        <Link href="/dev/login" className={className}>
          {label} <ArrowRight size={15} />
        </Link>
      );
    }
    return (
      <button className={className} onClick={handleLogin}>
        {label} <ArrowRight size={15} />
      </button>
    );
  };

  return (
    <div className="landing-root">
      {/* ambient glow behind content */}
      <div className="lp-glow" />

      {/* ════════ NAVBAR ════════════════════════════════════════════════════ */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          <Link href="/" className="flex items-center gap-2" style={{ display: 'inline-flex', alignItems: 'center', gap: '10px' }}>
            <svg
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ width: '22px', height: '22px', color: 'var(--neon)' }}
            >
              <circle cx="12" cy="4" r="2" />
              <line x1="12" y1="6" x2="12" y2="14" />
              <path d="M7 14 Q12 19 17 14" />
              <line x1="9" y1="10" x2="6" y2="10" />
              <circle cx="5" cy="10" r="1" />
              <line x1="15" y1="10" x2="18" y2="10" />
              <circle cx="19" cy="10" r="1" />
            </svg>
            <span className="wordmark">MergeShip</span>
          </Link>
        </div>

        <div className="nav-links">
          <Link className="nav-link" href="/#pain">Platform</Link>
          <Link className="nav-link" href="/#triage">Features</Link>
          <Link className="nav-link" href="/docs">Docs</Link>
          <Link className="nav-link" href="/#cta">Pricing</Link>
        </div>

        <div className="nav-auth">
          {!configured ? (
            <span className="btn-signin" style={{ cursor: 'not-allowed' }}>
              Sign-in coming soon
            </span>
          ) : user ? (
            <>
              <span className="btn-signin">{user.name || user.email}</span>
              <Link href="/dashboard" className="btn-neon">Dashboard</Link>
              <button className="btn-signin" onClick={handleLogout}>Sign Out</button>
            </>
          ) : (
            <>
              {localDev ? (
                <Link href="/dev/login" className="btn-signin-border">Login</Link>
              ) : (
                <button className="btn-signin-border" onClick={handleLogin}>Login</button>
              )}
              <PrimaryCTA label="Get started" className="btn-neon" />
            </>
          )}
        </div>

        <button
          className="mobile-menu-btn"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>
      </nav>

      {/* mobile menu */}
      {menuOpen && (
        <>
          <div className="mobile-overlay" onClick={() => setMenuOpen(false)} />
          <div className="mobile-nav">
            <Link href="/#pain" onClick={() => setMenuOpen(false)}>Platform</Link>
            <Link href="/#triage" onClick={() => setMenuOpen(false)}>Features</Link>
            <Link href="/docs" onClick={() => setMenuOpen(false)}>Docs</Link>
            <Link href="/#cta" onClick={() => setMenuOpen(false)}>Pricing</Link>
            <div className="mobile-nav-divider" />
            {!configured ? (
              <span style={{ padding: '14px 24px', color: 'var(--text-muted)' }}>
                Sign-in coming soon
              </span>
            ) : user ? (
              <>
                <Link href="/dashboard" className="btn-neon" onClick={() => setMenuOpen(false)}>
                  Dashboard <ArrowRight size={15} />
                </Link>
                <button className="mobile-link" onClick={() => { handleLogout(); setMenuOpen(false); }}>
                  Sign Out
                </button>
              </>
            ) : (
              <>
                {localDev ? (
                  <Link href="/dev/login" onClick={() => setMenuOpen(false)}>Login</Link>
                ) : (
                  <button className="mobile-link" onClick={() => { handleLogin(); setMenuOpen(false); }}>
                    Login
                  </button>
                )}
                <PrimaryCTA label="Get started" />
              </>
            )}
          </div>
        </>
      )}

      {/* ════════ MANIFESTO CONTENT ════════════════════════════════════════ */}
      <main className="docs-container">
        <span className="manifesto-badge">Manifesto</span>
        
        <h1 className="docs-h1">
          The Maintainer's<br />Burden.
        </h1>

        <p className="docs-sub">
          Why we built MergeShip, and why the current state of continuous integration is fundamentally broken for high-velocity teams.
        </p>

        <div className="docs-body">
          <p>
            There is a silent tax levied on every engineering team as they scale. It isn't paid in dollars, but in cycles. It is the insidious creeping slowness of the integration pipeline. What begins as a snappy, instantaneous feedback loop degenerates into a sluggish, fragile monster that demands constant feeding and watering by dedicated DevOps engineers.
          </p>

          <p>
            We accept this as normal. We tell ourselves that scale implies friction. But this is a failure of imagination. The tools we use to orchestrate our builds were designed for a different era—an era before serverless architectures, distributed caching, and deterministic execution environments became ubiquitous.
          </p>

          <blockquote className="docs-quote">
            "The most expensive resource in any software company is not compute. It is engineer attention. Every minute spent waiting for a build to pass is a minute where context is lost and momentum dies."
          </blockquote>

          <p>
            Consider the lifecycle of a typical pull request in a mature codebase. The developer writes code, commits, and pushes. Then, they wait. They switch tasks, perhaps answering Slack messages or reviewing another PR. By the time the CI pipeline inevitably fails—often due to a flaky integration test or an outdated cache—the developer's mental context has completely shifted. The cost of context switching is monumental, yet it rarely appears on any balance sheet.
          </p>

          <h2 className="docs-h2">The Illusion of Speed</h2>

          <p>
            Many modern CI providers boast about container startup times or raw compute power. But raw compute is only part of the equation. True velocity comes from intelligent orchestration—understanding the dependency graph of a monorepo so deeply that only the absolutely necessary artifacts are rebuilt.
          </p>

          <p>
            We built MergeShip because we were tired of paying the maintainer's tax. We wanted a system that felt less like a distant server running bash scripts, and more like a local compiler running directly on our development machines. A system that is deterministic, fiercely aggressive with caching, and totally transparent in its execution.
          </p>
        </div>
      </main>

      {/* ════════ FOOTER ═════════════════════════════════════════════════= */}
      <footer className="lp-footer" id="footer">
        <div className="footer-row">
          <div className="footer-copy">
            © 2026 MergeShip. <span>Built for performance.</span>
          </div>
          <div className="footer-links">
            <a href="#">Security</a>
            <a href="#">Terms</a>
            <a href="#">Privacy</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
