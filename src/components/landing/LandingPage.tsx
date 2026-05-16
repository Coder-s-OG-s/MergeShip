/* eslint-disable */
// @ts-nocheck — partner's landing page; backend rebuild keeps it untouched except for auth swap
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { motion, useScroll, animate } from 'framer-motion';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { getBrowserSupabase } from '@/lib/supabase/browser';
import '@/app/landing.css';

type NavUser = { name: string | null; email: string | null };

const HeroScene = dynamic(() => import('./HeroScene'), { ssr: false });

// ─── Shared hook ────────────────────────────────────────────────────────────

function useInView(ref: React.RefObject<Element>, opts: { once?: boolean; margin?: string; fallbackMs?: number } = {}) {
  const { once = true, margin = '0px', fallbackMs = 1800 } = opts;
  const [inView, setInView] = useState(false);
  useEffect(() => {
    if (!ref.current) return;
    let done = false;
    const reveal = () => { if (!done) { done = true; setInView(true); } };
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) { reveal(); if (once) io.disconnect(); }
          else if (!once) setInView(false);
        }
      },
      { rootMargin: margin, threshold: 0.05 }
    );
    io.observe(ref.current);
    const t = setTimeout(reveal, fallbackMs);
    return () => { io.disconnect(); clearTimeout(t); };
  }, []);
  return inView;
}

// ─── FadeUp ──────────────────────────────────────────────────────────────────

function FadeUp({
  delay = 0, y = 16, duration = 0.6, children, className = '',
  style = {}, as: As = 'div',
}: {
  delay?: number; y?: number; duration?: number; children?: React.ReactNode;
  className?: string; style?: React.CSSProperties; as?: React.ElementType;
}) {
  return (
    <As
      className={`${className} fade-up`}
      style={{ ...style, animationDelay: `${delay}s`, animationDuration: `${duration}s`, '--fade-y': `${y}px` } as React.CSSProperties}
    >
      {children}
    </As>
  );
}

// ─── SplitText ───────────────────────────────────────────────────────────────

function SplitText({ text, delay = 0 }: { text: string; delay?: number }) {
  const words = text.split(' ');
  let charIndex = 0;
  const elements: React.ReactNode[] = [];
  words.forEach((word, wi) => {
    const isItalic = word.startsWith('*') && word.endsWith('*');
    const clean = isItalic ? word.slice(1, -1) : word;
    elements.push(
      <span key={`w${wi}`} className="split-word" style={isItalic ? { fontStyle: 'italic' } : {}}>
        {clean.split('').map((c, ci) => {
          const idx = charIndex++;
          return (
            <span
              key={`w${wi}c${ci}`}
              className="split-char split-char-anim"
              style={{ animationDelay: `${delay + idx * 0.024}s` }}
            >
              {c}
            </span>
          );
        })}
      </span>
    );
    if (wi < words.length - 1) elements.push(<span key={`sp${wi}`}>&nbsp;</span>);
  });
  return <span>{elements}</span>;
}

// ─── StatNumber ──────────────────────────────────────────────────────────────

function StatNumber({ value, duration = 1.2 }: { value: string; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true });
  const isPercent = value.includes('%');
  const isNeg = value.startsWith('−');
  const isK = value.toLowerCase().endsWith('k');
  const num = parseFloat(value.replace(/[^0-9.]/g, ''));

  const fmt = useCallback((v: number) => {
    if (num >= 1000) return Math.round(v).toLocaleString();
    if (isK) return v.toFixed(1);
    if (num % 1 !== 0) return v.toFixed(1);
    return Math.round(v).toString();
  }, [num, isK]);

  const [display, setDisplay] = useState(fmt(num));
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;
    if (document.visibilityState !== 'visible') { setDisplay(fmt(num)); return; }
    setDisplay(fmt(0));
    const controls = animate(0, num, {
      duration,
      ease: [0.22, 1, 0.36, 1] as [number, number, number, number],
      onUpdate: (v: number) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
  }, [inView, num, duration, fmt]);

  const suffix = isPercent ? '%' : isK ? 'k' : '';
  return (
    <span ref={ref} className="serif">
      {isNeg ? '−' : ''}{display}{suffix}
    </span>
  );
}

// ─── SectionHeader ───────────────────────────────────────────────────────────

function SectionHeader({ num, title }: { num: string; title: string }) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true });
  const target = parseInt(num, 10);
  const fmt = (v: number) => String(Math.round(v)).padStart(2, '0');
  const [display, setDisplay] = useState(fmt(target));
  const startedRef = useRef(false);

  useEffect(() => {
    if (!inView || startedRef.current) return;
    startedRef.current = true;
    if (document.visibilityState !== 'visible') { setDisplay(fmt(target)); return; }
    setDisplay('00');
    const controls = animate(0, target, {
      duration: 0.4,
      onUpdate: (v: number) => setDisplay(fmt(v)),
    });
    return () => controls.stop();
  }, [inView, target]);

  return (
    <div ref={ref} className="section-header">
      <div className="section-num">{display} / {title.split(' ')[0]}</div>
      <div className="section-title">{title}</div>
    </div>
  );
}

// ─── SectionCurtain ──────────────────────────────────────────────────────────

function SectionCurtain({ children, dark, className = '' }: {
  children: React.ReactNode; dark?: boolean; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-10%' });
  const [phase, setPhase] = useState<'idle' | 'wiping' | 'done'>('idle');

  useEffect(() => {
    if (inView && phase === 'idle') {
      setPhase('wiping');
      const t = setTimeout(() => setPhase('done'), 900);
      return () => clearTimeout(t);
    }
  }, [inView, phase]);

  return (
    <section ref={ref} className={`section ${dark ? 'section-dark' : ''} ${className}`}>
      <motion.div
        className="curtain"
        initial={{ scaleX: 0 }}
        animate={
          phase === 'wiping' ? { scaleX: [0, 1, 1, 0] } :
          phase === 'done' ? { scaleX: 0 } : { scaleX: 0 }
        }
        transition={{ duration: 0.9, times: [0, 0.45, 0.55, 1], ease: [0.76, 0, 0.24, 1] }}
        style={{ background: dark ? '#000' : '#111110', transformOrigin: 'left' }}
      />
      <div className="section-inner">{children}</div>
    </section>
  );
}

// ─── Nav ─────────────────────────────────────────────────────────────────────

// Local Supabase doesn't have the GitHub OAuth provider enabled (we don't
// commit a config.toml with a client secret). On a contributor's laptop, the
// "Get Started" button has to route to /dev/login instead — same flow the
// dev-login page itself uses. On prod (mergeship.dev → *.supabase.co) the
// real OAuth flow still runs.
function isLocalSupabase(): boolean {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
  return url.includes('127.0.0.1') || url.includes('localhost');
}

function NavAuth() {
  const [user, setUser] = useState<NavUser | null>(null);
  const [configured, setConfigured] = useState<boolean>(true);
  const localDev = isLocalSupabase();

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
        (meta['name'] as string | undefined) ?? (meta['user_name'] as string | undefined) ?? null;
      setUser({ name, email: u.email ?? null });
    });
  }, []);

  const handleLogin = () => {
    const origin = window.location.origin;
    const sb = getBrowserSupabase();
    if (!sb) return;
    void sb.auth.signInWithOAuth({
      provider: 'github',
      options: { redirectTo: `${origin}/api/auth/callback?next=/dashboard` },
    });
  };

  const handleLogout = async () => {
    const sb = getBrowserSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    setUser(null);
  };

  if (!configured) {
    return (
      <button className="btn" disabled title="Auth not configured on this deployment">
        Sign-in coming soon
      </button>
    );
  }

  if (user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
        <span style={{
          fontFamily: 'var(--font-dm-mono), DM Mono, monospace',
          fontSize: '0.72rem',
          textTransform: 'uppercase',
          letterSpacing: '0.08em',
          color: 'var(--ink-muted)',
        }}>
          {user.name || user.email}
        </span>
        <Link href="/dashboard" className="btn" style={{ fontSize: '0.72rem' }}>
          Dashboard →
        </Link>
        <button className="btn-ghost" onClick={handleLogout}>Sign Out</button>
      </div>
    );
  }
  if (localDev) {
    return (
      <Link href="/dev/login" className="btn">
        Sign in (dev) →
      </Link>
    );
  }

  return (
    <button className="btn" onClick={handleLogin}>
      Get Started →
    </button>
  );
}

function Nav() {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <nav className={`nav ${scrolled ? 'scrolled' : ''}`}>
      <div className="nav-logo">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="12" cy="4" r="1.8" />
          <line x1="12" y1="5.8" x2="12" y2="14" />
          <path d="M7 14 Q12 19 17 14" />
          <line x1="9" y1="11" x2="6" y2="11" />
          <circle cx="5" cy="11" r="1.2" />
          <line x1="15" y1="11" x2="18" y2="11" />
          <circle cx="19" cy="11" r="1.2" />
        </svg>
        <span className="wordmark">MergeShip</span>
      </div>
      <div className="nav-links">
        <a className="nav-link" href="#contributors">For Contributors</a>
        <a className="nav-link" href="#maintainers">For Maintainers</a>
        <a className="nav-link" href="#how">How It Works</a>
        <a className="nav-link" href="#levels">Levels</a>
      </div>
      <NavAuth />
    </nav>
  );
}

// ─── Hero ────────────────────────────────────────────────────────────────────

function Hero() {
  const ref = useRef<HTMLElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const [sp, setSp] = useState(0);
  useEffect(() => scrollYProgress.on('change', setSp), [scrollYProgress]);

  return (
    <section className="hero" ref={ref} id="hero">
      <div className="hero-side hero-left" id="contributors">
        <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
          <HeroScene scrollProgress={sp} />
        </div>
        <div className="hero-content">
          <FadeUp className="hero-tag" delay={0} y={12}>
            <span className="dot" />
            FOR CONTRIBUTORS
          </FadeUp>
          <h1 className="hero-h1">
            <span style={{ display: 'block' }}><SplitText text="Learn open source" delay={0.1} /></span>
            <span style={{ display: 'block' }}><SplitText text="the *right* way." delay={0.4} /></span>
          </h1>
          <FadeUp as="p" className="hero-body" delay={0.9} y={16} duration={0.7}>
            Most contributors fail before they start. No path. No community. No feedback.
            MergeShip changes that — level by level, PR by PR.
          </FadeUp>
          <FadeUp className="hero-ctas" delay={1.1} y={24}>
          <Link
            href="/dashboard"
            className="btn"
            onClick={(e) => {
              const isLoggedIn = false;
              if (!isLoggedIn) {
                e.preventDefault();
                alert("Please sign in first to continue.");
                window.location.href = "/signin";
              }
            }}
          >
            Start Contributing →
          </Link>
            <a href="#features" className="btn-ghost">see how it works →</a>
          </FadeUp>
        </div>
        <FadeUp className="hero-stats" delay={1.3} y={0}>
          <div><div className="stat-value"><StatNumber value="1247" /></div><div className="stat-label">Active contributors</div></div>
          <div><div className="stat-value"><StatNumber value="92%" /></div><div className="stat-label">First PR merged</div></div>
          <div><div className="stat-value"><StatNumber value="4" /></div><div className="stat-label">Skill levels</div></div>
        </FadeUp>
      </div>

      <div className="hero-side hero-right" id="maintainers">
        <div className="hero-content">
          <FadeUp className="hero-tag" delay={0.2} y={12}>
            <span className="dot" />
            FOR MAINTAINERS
          </FadeUp>
          <h1 className="hero-h1">
            <span style={{ display: 'block' }}><SplitText text="Stop drowning in" delay={0.3} /></span>
            <span style={{ display: 'block' }}>
              <span className="lp-green" style={{ fontStyle: 'italic' }}><SplitText text="AI slop" delay={0.7} /></span>
              {' '}
              <SplitText text="PRs." delay={0.85} />
            </span>
          </h1>
          <FadeUp as="p" className="hero-body" delay={1.0} y={16} duration={0.7}>
            A smart command center that surfaces what matters, buries the noise,
            and lets peer-verified PRs reach you pre-checked.
          </FadeUp>
          <FadeUp className="hero-ctas" delay={1.2} y={24}>
            <Link href="/dashboard" className="btn btn-light">Connect Your Org →</Link>
            <a href="#how" className="btn-ghost dark">see the dashboard →</a>
          </FadeUp>
        </div>
        <FadeUp className="hero-stats" delay={1.4} y={0}>
          <div><div className="stat-value"><StatNumber value="38" /></div><div className="stat-label">Orgs onboarded</div></div>
          <div><div className="stat-value"><StatNumber value="12.5k" /></div><div className="stat-label">PRs routed</div></div>
          <div><div className="stat-value"><StatNumber value="−74%" /></div><div className="stat-label">Review noise</div></div>
        </FadeUp>
      </div>
    </section>
  );
}

// ─── Ticker ──────────────────────────────────────────────────────────────────

function Ticker() {
  const items = [
    { tag: 'PR #1234 MERGED', body: 'L3 MENTOR VERIFIED', red: false },
    { tag: 'AI-GENERATED PR DETECTED', body: 'AUTO-FLAGGED — kyverno/chainsaw', red: true },
    { tag: 'NEW CONTRIBUTOR ONBOARDED', body: '@aria.dev → LEVEL 1', red: false },
    { tag: 'PR #4827 L2 VERIFIED', body: 'envoyproxy/gateway · 3m ago', red: false },
    { tag: 'LEVEL UP', body: '@hiro.k REACHED LEVEL 2', red: false },
    { tag: 'PR #9821 FLAGGED', body: 'LOW-QUALITY DUPLICATE', red: true },
    { tag: 'PR #7733 MERGED', body: 'L3 MENTOR VERIFIED — opentofu', red: false },
    { tag: 'MENTOR CHAIN COMPLETE', body: '4 PRs FAST-TRACKED', red: false },
    { tag: 'NEW ORG CONNECTED', body: 'kubernetes-sigs/karpenter', red: false },
  ];
  const doubled = [...items, ...items];
  return (
    <div className="ticker">
      <div className="ticker-track">
        {doubled.map((it, i) => (
          <span className="ticker-item" key={i}>
            <span className={`ticker-tag${it.red ? ' red' : ''}`}>{it.tag}</span>
            <span>{it.body}</span>
            <span className="ticker-sep">·</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Problem ─────────────────────────────────────────────────────────────────

function Problem() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-15%' });
  const left = [
    { t: 'No Knowledge', b: 'New contributors face a wall — repos with no roadmap, no entry points, no sense of where a beginner should start.' },
    { t: 'No Guided Path', b: 'Tutorials end at "fork the repo." Real contribution skills — review, scope, communication — are learned by accident, if at all.' },
    { t: 'No Community', b: 'Forums are dead. Discord is noise. Mentorship is a favor you have to ask for in DMs and rarely receive.' },
  ];
  const right = [
    { t: 'AI Slop PRs', b: 'Auto-generated diffs flood the queue. Maintainers waste hours triaging trash that looks plausible but adds nothing.' },
    { t: 'Scattered Data', b: 'Contributor trust, history, and skill live across GitHub, Discord, and memory. No unified signal to act on.' },
    { t: 'Too Much to Handle', b: 'A handful of maintainers absorb the cost of every contributor who shows up unprepared. Burnout is the default outcome.' },
  ];
  return (
    <SectionCurtain>
      <SectionHeader num="01" title="THE OPEN SOURCE DIVIDE" />
      <div className="problem-grid" ref={ref}>
        <div className="problem-col">
          <div className="problem-head"><span className="dot" />CONTRIBUTORS — LOST &amp; UNSTRUCTURED</div>
          {left.map((p, i) => (
            <motion.div
              key={i}
              className="problem-item"
              initial={{ opacity: 0, x: -40 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="problem-item-title">{p.t}</div>
              <div className="problem-item-body">{p.b}</div>
            </motion.div>
          ))}
        </div>
        <div className="problem-col">
          <div className="problem-head"><span className="dot" />MAINTAINERS — FLOODED &amp; OVERWHELMED</div>
          {right.map((p, i) => (
            <motion.div
              key={i}
              className="problem-item"
              initial={{ opacity: 0, x: 40 }}
              animate={inView ? { opacity: 1, x: 0 } : {}}
              transition={{ duration: 0.6, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="problem-item-title">{p.t}</div>
              <div className="problem-item-body">{p.b}</div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionCurtain>
  );
}

// ─── HowItWorks ──────────────────────────────────────────────────────────────

function HowItWorks() {
  const [active, setActive] = useState(0);
  const flows = [
    {
      name: 'CONTRIBUTOR FLOW',
      steps: [
        { t: 'Sign in with GitHub', b: 'A profile scan reads your existing contributions and auto-places you at the right starting level. No quiz, no LinkedIn skill grid.', tag: 'AUTO-PLACEMENT' },
        { t: 'Get placed at the right level', b: 'Smart onboarding caps new accounts at Level 2 — even if your GitHub history is strong. Trust is earned inside the system.', tag: 'L0 — L2 ENTRY' },
        { t: 'Work issues, get mentored', b: 'Every PR you open is reviewed by an L2 or L3 mentor before it touches the maintainer queue. Hierarchical peer review, baked in.', tag: 'PEER REVIEW' },
        { t: 'Earn, level up, unlock harder work', b: 'XP, badges, and a verifiable portfolio. Higher levels unlock harder issues and the ability to mentor others.', tag: 'PROGRESSION' },
      ],
    },
    {
      name: 'MAINTAINER FLOW',
      steps: [
        { t: 'Connect your org', b: 'One OAuth flow pulls in every repo, contributor, and PR. Existing labels and CODEOWNERS are respected, not replaced.', tag: 'GITHUB OAUTH' },
        { t: 'Define gates per repo', b: 'Decide which level can touch which directories. Lock the docs/ folder to L1+, the core to L3+ — granularity without overhead.', tag: 'ACCESS GATES' },
        { t: 'Receive pre-checked PRs', b: 'PRs arrive with a Trust Score and mentor sign-off. AI-flagged submissions never reach your inbox.', tag: 'TRUST SCORE' },
        { t: 'Grow your reviewer pool', b: 'Promising contributors are surfaced — promote them to L3 with one click and let them carry review weight.', tag: 'DELEGATION' },
      ],
    },
    {
      name: 'THE FLYWHEEL',
      steps: [
        { t: 'Contributors land prepared', b: 'New developers arrive with a path, not a Discord ping. Day one is productive, not exhausting.', tag: 'INPUT' },
        { t: 'Mentors carry the review load', b: 'Mid-level contributors review junior PRs. Senior contributors review mid-level reviews. Pressure spreads.', tag: 'DISTRIBUTION' },
        { t: 'Maintainers gain leverage', b: 'A small core ships more by reviewing less. Energy returns to the work that only they can do.', tag: 'LEVERAGE' },
        { t: 'The community compounds', b: 'Trained L2s become L3s. L3s become maintainers. The pipeline is the product.', tag: 'COMPOUNDING' },
      ],
    },
  ];
  return (
    <SectionCurtain>
      <SectionHeader num="02" title="ONE LOGIN. INTELLIGENT ROUTING." />
      <div className="how-grid" id="features">
        <div className="how-index">
          {flows.map((f, i) => (
            <button key={i} className={`how-index-item${active === i ? ' active' : ''}`} onClick={() => setActive(i)}>
              {f.name}
            </button>
          ))}
        </div>
        <div className="how-steps">
          {flows[active].steps.map((s, i) => (
            <motion.div
              key={`${active}-${i}`}
              className="how-step"
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
            >
              <div className="how-step-num">{String(i + 1).padStart(2, '0')}</div>
              <div>
                <div className="how-step-title">{s.t}</div>
                <div className="how-step-body">{s.b}</div>
                <div className="how-step-tag">
                  <span style={{ width: 6, height: 6, background: 'var(--green)', borderRadius: '50%', display: 'inline-block' }} />
                  {s.tag}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </SectionCurtain>
  );
}

// ─── Levels ──────────────────────────────────────────────────────────────────

function Levels() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-10%' });
  const cards = [
    { n: 'L0', t: 'Newcomer', d: '5-day course only. No repo access until the orientation track is complete.', a: 'COURSE ONLY', p: 25 },
    { n: 'L1', t: 'Contributor', d: 'Basic issues — bugs, docs, low-risk patches. Mentored review on every PR.', a: 'BASIC ISSUES', p: 50 },
    { n: 'L2', t: 'Practitioner', d: 'Intermediate issues. Eligible to review L1 PRs and contribute to mentorship chains.', a: 'INTERMEDIATE + REVIEW', p: 75 },
    { n: 'L3', t: 'Expert', d: 'Advanced issues, core code paths, mentor privileges, and trust-score weighting on reviews.', a: 'ADVANCED + MENTOR', p: 100 },
  ];
  return (
    <SectionCurtain dark>
      <SectionHeader num="03" title="LEVELS ARE ACCESS GATES, NOT COSMETICS" />
      <div className="levels-grid" ref={ref} id="levels">
        {cards.map((c, i) => (
          <motion.div
            key={i}
            className="level-card"
            initial={{ opacity: 0, y: 60 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ type: 'spring', stiffness: 80, damping: 15, delay: i * 0.08 }}
          >
            <div className="level-num">{c.n}</div>
            <div className="level-title">{c.t}</div>
            <div className="level-desc">{c.d}</div>
            <div className="level-access">→ {c.a}</div>
            <div className="level-progress">
              <motion.div
                className="level-progress-bar"
                initial={{ width: '0%' }}
                animate={inView ? { width: `${c.p}%` } : {}}
                transition={{ duration: 1.2, delay: 0.4 + i * 0.08, ease: [0.22, 1, 0.36, 1] }}
              />
            </div>
          </motion.div>
        ))}
      </div>
      <motion.div
        className="levels-note"
        initial={{ opacity: 0 }}
        animate={inView ? { opacity: 1 } : {}}
        transition={{ duration: 0.6, delay: 0.8 }}
      >
        <span className="label">NOTE</span>
        Level 3 cannot be imported from GitHub. It requires actually solving Level 2 issues inside MergeShip — so it stays fair and cannot be gamed.
      </motion.div>
    </SectionCurtain>
  );
}

// ─── Mentorship ──────────────────────────────────────────────────────────────

function Mentorship() {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-15%' });

  const nodes = [
    { l: 'L1 CONTRIBUTOR', d: 'Submits the initial PR. Tagged with their level and Trust Score.', green: false },
    { l: 'L2 MENTOR REVIEWS', d: 'Reviews diff, unblocks the contributor, tags as verified.', green: true },
    { l: 'L3 MENTOR REVIEWS', d: 'For complex work, deepens verification and signs off on architecture.', green: true },
    { l: 'MAINTAINER RECEIVES', d: 'PR arrives pre-tagged. Review is fast-tracked, often a single approval away.', green: false },
  ];
  const prs = [
    { n: '#1234', t: 'fix: cleanup error in file handler', m: 'kyverno/chainsaw · 2h ago', b: 'L3 VERIFIED', c: 'verified-strong', bc: 'badge-green' },
    { n: '#1235', t: 'feat: skip step based on condition', m: 'kyverno/chainsaw · 4h ago', b: 'L2 VERIFIED', c: 'verified', bc: 'badge-green' },
    { n: '#1236', t: 'update README.md typos', m: 'kyverno/chainsaw · 6h ago', b: 'L1 · UNVERIFIED', c: 'muted', bc: 'badge-muted' },
    { n: '#1237', t: 'optimize entire codebase performance', m: 'kyverno/chainsaw · 1d ago', b: 'AI FLAGGED', c: 'flagged', bc: 'badge-red' },
  ];

  return (
    <SectionCurtain>
      <SectionHeader num="04" title="THE REVIEW WEIGHT DOESN'T FALL ON ONE PERSON" />
      <div className="mentor-grid" ref={ref}>
        <div>
          <motion.h2
            className="mentor-heading"
            initial={{ opacity: 0, y: 24 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6 }}
          >
            Mentorship is the <span style={{ fontStyle: 'italic' }}>infrastructure</span>, not the favor.
          </motion.h2>
          <motion.p
            className="mentor-body"
            initial={{ opacity: 0, y: 16 }}
            animate={inView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay: 0.1 }}
          >
            Every PR walks up a chain of trust before it reaches a maintainer. The contributor learns.
            The reviewer leads. The maintainer gets a clean diff and a signed-off context.
          </motion.p>
          <div className="chain">
            <svg className="chain-svg" viewBox="0 0 2 600" preserveAspectRatio="none" style={{ height: '100%', width: 2 }}>
              <motion.line
                x1="1" y1="0" x2="1" y2="600"
                stroke="#111110"
                strokeWidth="1.5"
                initial={{ pathLength: 0 }}
                animate={inView ? { pathLength: 1 } : {}}
                transition={{ duration: 1.8, ease: [0.22, 1, 0.36, 1] }}
              />
            </svg>
            {nodes.map((n, i) => (
              <motion.div
                key={i}
                className={`chain-node${n.green ? ' chain-green' : ''}`}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={inView ? { opacity: 1, scale: 1 } : {}}
                transition={{ type: 'spring', stiffness: 200, damping: 14, delay: 0.4 + i * 0.4 }}
              >
                <div className={`chain-label${n.green ? ' chain-green' : ''}`}>{n.l}</div>
                <div className="chain-desc">{n.d}</div>
              </motion.div>
            ))}
          </div>
        </div>
        <div>
          <div className="queue-label">MAINTAINER QUEUE — kyverno/chainsaw</div>
          <div className="queue">
            {prs.map((p, i) => (
              <motion.div
                key={i}
                className={`pr-card ${p.c}`}
                initial={{ opacity: 0, x: 60 }}
                animate={inView ? { opacity: 1, x: 0 } : {}}
                transition={{ duration: 0.6, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
                whileHover={{ y: -4 }}
              >
                <div className="pr-title"><span className="lp-muted">{p.n}</span> — {p.t}</div>
                <div className="pr-meta">{p.m}</div>
                <span className={`pr-badge ${p.bc}`}>{p.b}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    </SectionCurtain>
  );
}

// ─── Comparison ──────────────────────────────────────────────────────────────

function Comparison() {
  const rows: [string, boolean, boolean, boolean][] = [
    ['Level-by-level issue unlocking', true, false, false],
    ['GitHub profile auto-placement', true, false, false],
    ['Hierarchical peer mentorship', true, false, false],
    ['Contributor Trust Score on PRs', true, false, false],
    ['AI-generated PR detection', true, false, true],
    ['Smart PR queue by trust', true, false, false],
    ['Verifiable open source portfolio', true, false, true],
    ['Unified contributor + maintainer', true, false, false],
  ];
  const ref = useRef<HTMLTableElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-10%' });

  return (
    <SectionCurtain>
      <SectionHeader num="05" title="WHERE WE STAND" />
      <table className="compare-table" ref={ref}>
        <thead>
          <tr>
            <th>Feature</th>
            <th className="merge-col">MergeShip</th>
            <th>GitHub Native</th>
            <th>Others</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <motion.tr
              key={i}
              initial={{ opacity: 0, y: 12 }}
              animate={inView ? { opacity: 1, y: 0 } : {}}
              transition={{ duration: 0.4, delay: i * 0.04 }}
            >
              <td>{r[0]}</td>
              <td className="merge-col"><span className={r[1] ? 'check' : 'dash'}>{r[1] ? '✓' : '—'}</span></td>
              <td><span className={r[2] ? 'check' : 'dash'}>{r[2] ? '✓' : '—'}</span></td>
              <td><span className={r[3] ? 'check' : 'dash'}>{r[3] ? '✓' : '—'}</span></td>
            </motion.tr>
          ))}
        </tbody>
      </table>
    </SectionCurtain>
  );
}

// ─── CtaSplit ────────────────────────────────────────────────────────────────

function CtaSplit() {
  return (
    <section className="cta-split">
      <div className="cta-half">
        <div className="lead"><span className="dot" />FOR CONTRIBUTORS</div>
        <h2>Your first real contribution starts here.</h2>
        <div>
          <motion.a
            href="/dashboard"
            className="btn"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ display: 'inline-flex' }}
          >
            Start Contributing →
          </motion.a>
        </div>
      </div>
      <div className="cta-half dark">
        <div className="lead"><span className="dot" />FOR MAINTAINERS</div>
        <h2>Connect your org. Review with confidence.</h2>
        <div>
          <motion.a
            href="/dashboard"
            className="btn btn-light"
            whileHover={{ scale: 1.02 }}
            transition={{ type: 'spring', stiffness: 400, damping: 20 }}
            style={{ display: 'inline-flex' }}
          >
            Connect Your Org →
          </motion.a>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ──────────────────────────────────────────────────────────────────

function Footer() {
  const ref = useRef<HTMLElement>(null);
  const inView = useInView(ref as React.RefObject<Element>, { once: true, margin: '-10%' });
  return (
    <footer className="lp-footer" ref={ref}>
      <div className="footer-grid">
        <div>
          <motion.span
            className="footer-brand-big"
            initial={{ scale: 2.4, opacity: 0 }}
            animate={inView ? { scale: 1, opacity: 1 } : {}}
            transition={{ type: 'spring', stiffness: 90, damping: 14 }}
          >
            MergeShip
          </motion.span>
          <div className="footer-tagline">Helping contributors learn the right way. Helping maintainers stay sane.</div>
        </div>
        <div className="footer-links">
          <a href="#">Docs</a>
          <a href="#">Pricing</a>
          <a href="#">Changelog</a>
          <a href="https://github.com/Coder-s-OG-s/MergeShip">GitHub</a>
          <a href="#">Status</a>
        </div>
      </div>
      <div className="footer-bottom">
        <div>© 2026 MergeShip Labs</div>
        <div>SHIP / VERIFY / MERGE</div>
      </div>
    </footer>
  );
}

// ─── Root ─────────────────────────────────────────────────────────────────────

export default function LandingPage() {
  const [forceReveal, setForceReveal] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setForceReveal(true), 2200);
    return () => clearTimeout(t);
  }, []);

  return (
    <div className={`landing-root${forceReveal ? ' force-reveal' : ''}`}>
      <Nav />
      <Hero />
      <Ticker />
      <Problem />
      <HowItWorks />
      <Levels />
      <Mentorship />
      <Comparison />
      <CtaSplit />
      <Footer />
    </div>
  );
}
