'use client';

import Link from 'next/link';

const STEPS = [
  {
    number: '01',
    title: 'Connect your GitHub',
    description: 'Link your GitHub account so we can track your PRs and contributions.',
    href: '/settings',
    cta: 'Go to Settings →',
  },
  {
    number: '02',
    title: 'Browse and claim an issue',
    description: 'Discover issues matched to your skill level and claim one to get started.',
    href: '/issues',
    cta: 'Browse Issues →',
  },
  {
    number: '03',
    title: 'Submit a PR',
    description: 'Push your fix, open a pull request, and earn your first XP on MergeShip.',
    href: '/my-prs',
    cta: 'View My PRs →',
  },
];

export function GettingStarted() {
  return (
    <section className="rounded-xl border border-[#2d333b] bg-[#161b22] p-8">
      {/* Header */}
      <div className="mb-8">
        <div className="mb-2 text-[10px] uppercase tracking-widest text-zinc-500">
          GETTING STARTED
        </div>
        <h2 className="font-serif text-2xl text-white">Welcome aboard, Contributor.</h2>
        <p className="mt-2 text-sm text-zinc-400">
          You have no XP yet. Follow these steps to make your first contribution.
        </p>
      </div>

      {/* Steps */}
      <div className="flex flex-col gap-4">
        {STEPS.map((step) => (
          <div
            key={step.number}
            className="flex items-start gap-5 rounded-lg border border-[#2d333b] bg-[#0d1117] p-5 transition-colors hover:border-zinc-600"
          >
            {/* Step number */}
            <span className="mt-0.5 font-mono text-xs font-bold text-emerald-400">
              {step.number}
            </span>

            {/* Content */}
            <div className="min-w-0 flex-1">
              <p className="font-mono text-sm font-semibold text-white">{step.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-zinc-400">{step.description}</p>
            </div>

            {/* CTA */}
            <Link
              href={step.href}
              className="shrink-0 text-xs text-emerald-400 transition-colors hover:text-emerald-300"
            >
              {step.cta}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
