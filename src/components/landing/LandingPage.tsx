'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import {
  AlertTriangle,
  Bot,
  Zap,
  Lock,
  Clock,
  Menu,
  X,
  ArrowRight,
  ChevronRight,
} from 'lucide-react';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import '@/app/landing.css';

type NavUser = { name: string | null; email: string | null };

function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.includes('127.0.0.1') || url.includes('localhost');
}

/* ── Animated counter ──────────────────────────────────────────────────── */
function StatNumber({ value, duration = 2 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [inView, setInView] = useState(false);

  const match = useMemo(() => {
    const m = /^([^0-9.]*)([0-9.]+)(.*)$/.exec(value);
    if (!m) return null;
    return {
      prefix: m[1] ?? '',
      num: parseFloat(m[2] ?? '0'),
      suffix: m[3] ?? '',
    };
  }, [value]);

  useEffect(() => {
    if (!ref.current) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e && e.isIntersecting) {
          setInView(true);
          io.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    io.observe(ref.current);
    return () => io.disconnect();
  }, []);

  const num = match ? match.num : 0;
  const start = useMemo(() => (Number.isFinite(num) && num > 0 ? num * 0.3 : 0), [num]);

  const fmt = useCallback(
    (v: number) => {
      if (num >= 1000) return Math.round(v).toLocaleString();
      if (num % 1 !== 0) return v.toFixed(1);
      return Math.round(v).toString();
    },
    [num],
  );

  useEffect(() => {
    const el = ref.current;
    if (!el || !inView || !match) return;
    let t0: number | null = null;
    const tick = (ts: number) => {
      if (!t0) t0 = ts;
      const p = Math.min((ts - t0) / (duration * 1000), 1);
      const ease = 1 - Math.pow(1 - p, 3);
      el.textContent = `${match.prefix}${fmt(start + (num - start) * ease)}${match.suffix}`;
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }, [inView, num, duration, fmt, start, match]);

  if (!match) {
    return <span>{value}</span>;
  }

  return (
    <span ref={ref}>
      {match.prefix}
      {fmt(start)}
      {match.suffix}
    </span>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ROOT COMPONENT
   ═══════════════════════════════════════════════════════════════════════════ */
export default function LandingPage() {
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

  const handleLogin = (nextPath: string | unknown = '/dashboard') => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    const next = typeof nextPath === 'string' ? nextPath : '/dashboard';
    void sb.auth.signInWithOAuth({
      provider: 'github',
      options: {
        redirectTo: `${window.location.origin}/api/auth/callback?next=${encodeURIComponent(next)}`,
      },
    });
  };

  const handleLogout = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
  };

  /* helper to render the primary CTA depending on auth state */
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
        <Link href="/dev/login?next=/onboarding" className={className}>
          {label} <ArrowRight size={15} />
        </Link>
      );
    }

    return (
      <button onClick={() => handleLogin('/onboarding')} className={className}>
        {label} <ArrowRight size={15} />
      </button>
    );
  };

  return (
    <div className="landing-root">
      {/* ambient glow behind hero */}
      <div className="lp-glow" />

      {/* ════════ NAVBAR ════════════════════════════════════════════════════ */}
      <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
        <div className="nav-logo">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
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
        </div>

        <div className="nav-links">
          <a className="nav-link" href="#pain">Platform</a>
          <a className="nav-link" href="#triage">Features</a>
          <Link className="nav-link" href="/docs">Docs</Link>
          <a className="nav-link" href="#cta">Pricing</a>
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
            <a href="#pain" onClick={() => setMenuOpen(false)}>Platform</a>
            <a href="#triage" onClick={() => setMenuOpen(false)}>Features</a>
            <Link href="/docs" onClick={() => setMenuOpen(false)}>Docs</Link>
            <a href="#cta" onClick={() => setMenuOpen(false)}>Pricing</a>
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

      {/* ════════ HERO ═════════════════════════════════════════════════════ */}
      <header className="hero">
        <div className="beta-pill">
          <span className="beta-star">★</span> NOW IN OPEN BETA
        </div>

        <h1 className="hero-h1">
          Open source,<br />done <span className="accent">right.</span>
        </h1>

        <p className="hero-sub">
          Intelligent triaging for high-velocity open source projects. Cut through the noise,
          empower your maintainers, and ship faster with context-aware PR queues.
        </p>

        <div className="hero-ctas">
          <PrimaryCTA label="Start Triaging" className="btn-neon-large" />
          <Link href="/docs" className="btn-link">
            View Documentation <span className="arrow-symbol">→</span>
          </Link>
        </div>
      </header>

      {/* ════════ METRICS ═════════════════════════════════════════════════= */}
      <section className="metrics">
        <div className="metric">
          <div className="metric-value"><StatNumber value="10k+" /></div>
          <div className="metric-label">PRs Managed</div>
        </div>
        <div className="metric">
          <div className="metric-value"><StatNumber value="<50ms" /></div>
          <div className="metric-label">Triage Latency</div>
        </div>
        <div className="metric">
          <div className="metric-value"><StatNumber value="99.9%" /></div>
          <div className="metric-label">Uptime SLA</div>
        </div>
        <div className="metric">
          <div className="metric-value"><StatNumber value="Zero" /></div>
          <div className="metric-label">Configuration</div>
        </div>
      </section>

      {/* ════════ PAIN POINTS ═════════════════════════════════════════════= */}
      <section className="pain-section" id="pain">
        <div className="section-head">
          <h2>Open source is broken for everyone.</h2>
          <p>
            Maintainers drown in noise. Contributors struggle to build trust. We fix both.
          </p>
        </div>

        <div className="pain-grid">
          <div className="pain-card">
            <div className="pain-icon"><AlertTriangle size={22} /></div>
            <h3>Maintainer Burnout</h3>
            <p>
              Triaging low-quality PRs eats time and energy. Delayed reviews stall the whole project.
            </p>
          </div>
          <div className="pain-card">
            <div className="pain-icon"><Bot size={22} /></div>
            <h3>AI Spam</h3>
            <p>
              Generative AI slop floods repositories. Maintainers waste hours on plausible-looking diffs that add nothing.
            </p>
          </div>
          <div className="pain-card">
            <div className="pain-icon"><Zap size={22} /></div>
            <h3>Steep Onboarding</h3>
            <p>
              No guided path, no entry points. Eager contributors bounce before their first PR is even opened.
            </p>
          </div>
          <div className="pain-card">
            <div className="pain-icon">
              <Lock size={18} /><Clock size={18} />
            </div>
            <h3>Stalled Velocity</h3>
            <p>
              Verified contributions sit buried under unreviewed backlog. Development velocity grinds to a halt.
            </p>
          </div>
        </div>
      </section>

      {/* ════════ TRIAGE QUEUE ════════════════════════════════════════════= */}
      <section className="triage-section" id="triage">
        <div className="triage-header">
          <h2>The Triage Queue</h2>
        </div>
        <p className="triage-sub">
          Context-aware routing ensures the right eyes are on the right code.
        </p>

        <div className="triage-window">
          <div className="window-header">
            <div className="window-dots">
              <span className="dot dot-red" />
              <span className="dot dot-yellow" />
              <span className="dot dot-green" />
            </div>
            <div className="window-title">triage_queue</div>
          </div>
          <div className="triage-list">
            <div className="triage-item">
              <span className="triage-dot green" />
              <div className="triage-info">
                <div className="triage-title">Refactor core routing engine</div>
                <div className="triage-meta">#1892 opened 8 hours ago by @ryan-lewis</div>
              </div>
              <div className="triage-badges">
                <span className="triage-badge expert">L3 Expert</span>
                <span className="triage-badge passed">Tests Passed</span>
              </div>
            </div>
            <div className="triage-item">
              <span className="triage-dot red" />
              <div className="triage-info">
                <div className="triage-title">Add guards and fallback</div>
                <div className="triage-meta">#1893 opened 12 hours ago by @anonymous</div>
              </div>
              <div className="triage-badges">
                <span className="triage-badge flagged">AI Flagged</span>
                <span className="triage-badge fail">CI Fail</span>
              </div>
            </div>
            <div className="triage-item">
              <span className="triage-dot yellow" />
              <div className="triage-info">
                <div className="triage-title">Update documentation types in README</div>
                <div className="triage-meta">#1894 opened 1 day ago by @contrib-bot</div>
              </div>
              <div className="triage-badges">
                <span className="triage-badge triaged">L1 Triaged</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ════════ CTA BANNER ═════════════════════════════════════════════= */}
      <section className="cta-section" id="cta">
        <div className="cta-card">
          <h2>Ready to ship better?</h2>
          <p>
            Join hundreds of developers and maintainers building clean, verified, high-velocity open source.
          </p>
          <PrimaryCTA label="Get Started Free" />
        </div>
      </section>

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