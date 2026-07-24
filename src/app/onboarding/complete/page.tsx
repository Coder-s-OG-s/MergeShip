import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, GitBranch, ShieldCheck, Users, Check } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { listMaintainerInstalls } from '@/lib/maintainer/detect';
import { getRepoPicker, getInstallationSettings } from '@/app/actions/maintainer';
import RepoNameTicker from './repo-name-ticker';

export const dynamic = 'force-dynamic';

/**
 * Maintainer onboarding step 3 — the completion screen (#332). Summarises what
 * the maintainer just configured: repos connected (rotating ticker, #334),
 * AI-generated PR detection, and the auto-assign mentor chain.
 *
 * The AI-detection row is a placeholder for now: its setting lands with #329,
 * so there's no value to read yet. The other two rows reflect real saved state.
 */
export default async function OnboardingCompletePage() {
  const sb = await getServerSupabase();
  if (!sb) redirect('/');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const installs = await listMaintainerInstalls(user.id);
  const install = installs[0];
  if (!install) redirect('/install');

  const [repoRes, settingsRes] = await Promise.all([
    getRepoPicker(install.installationId),
    getInstallationSettings(install.installationId),
  ]);

  // Surface a load failure via the nearest error boundary rather than silently
  // rendering "no repos connected" / "Off" right after the maintainer set these
  // up in step 2. Mirrors how /onboarding/repos handles the same fetch.
  if (!repoRes.ok) throw new Error(`Failed to load repos: ${repoRes.error.message}`);
  if (!settingsRes.ok) throw new Error(`Failed to load settings: ${settingsRes.error.message}`);

  const managedNames = repoRes.data.filter((r) => r.managed).map((r) => r.repoFullName);
  const autoAssignMentorChain = settingsRes.data.autoAssignMentorChain;

  return (
    <main className="flex min-h-screen flex-col bg-[#0D0E12] text-white">
      <header className="flex items-center justify-between px-6 py-4">
        {/* Logo */}
        <div className="nav-logo flex items-center gap-2.5">
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="h-[22px] w-[22px] text-[var(--neon)]"
          >
            <circle cx="12" cy="4" r="2" />
            <line x1="12" y1="6" x2="12" y2="14" />
            <path d="M7 14 Q12 19 17 14" />
            <line x1="9" y1="10" x2="6" y2="10" />
            <circle cx="5" cy="10" r="1" />
            <line x1="15" y1="10" x2="18" y2="10" />
            <circle cx="19" cy="10" r="1" />
          </svg>

          <span className="wordmark font-outfit text-[1.15rem] font-bold tracking-tight text-[var(--text-primary)]">
            MergeShip
          </span>
        </div>

        {/* Right side */}
        <div className="flex items-center gap-8">
          {/* Completed step indicator */}
          <div className="flex items-center text-sm text-gray-400">
            {['Connect Repo', 'Configure Routing', 'Complete'].map((label, index) => (
              <div key={label} className="flex items-center">
                <div className="flex items-center gap-2">
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-neon-green text-black">
                    <Check size={14} strokeWidth={3} />
                  </div>

                  <span className="whitespace-nowrap">{label}</span>
                </div>

                {index < 2 && <div className="mx-4 h-px w-12 bg-zinc-700" />}
              </div>
            ))}
          </div>
        </div>
      </header>
      <section className="flex flex-1 items-center justify-center px-6 py-16">
        <div className="flex w-full max-w-xl flex-col items-center text-center">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* Glow */}
            <div className="absolute inset-0 rounded-2xl bg-neon-green/10 blur-xl" />

            {/* Dashed square */}
            <div className="relative flex h-20 w-20 items-center justify-center rounded-2xl border-2 border-dashed border-neon-green/40 bg-neon-green/5">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-neon-green text-black shadow-[0_0_24px_rgba(0,255,135,0.35)]">
                <Check size={22} strokeWidth={3} />
              </div>
            </div>
          </div>

          <p className="mt-8 text-xs font-semibold uppercase tracking-[0.35em] text-neon-green">
            YOU&apos;RE ALL SET
          </p>

          <h1 className="mt-4 text-3xl font-bold md:text-4xl">
            <span className="text-neon-green">{install.accountLogin}</span> is live on MergeShip
          </h1>
          <p className="mt-3 text-zinc-400">
            Your review queue is set up. Here&apos;s what you just configured.
          </p>

          <div className="mt-10 w-full overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/40 text-left">
            <SummaryRow
              icon={<GitBranch className="h-4 w-4 text-zinc-400" />}
              label="Repos connected"
              badge={managedNames.length > 0 ? String(managedNames.length) : undefined}
            >
              <RepoNameTicker
                names={managedNames}
                className="text-sm font-medium text-white"
                emptyLabel="No repos connected"
              />
            </SummaryRow>

            <SummaryRow
              icon={<ShieldCheck className="h-4 w-4 text-zinc-400" />}
              label="AI-generated PR detection"
            >
              {/* Placeholder until #329 adds the detection setting. */}
              <span className="text-sm text-zinc-500">
                {settingsRes.data.aiPrDetection ? 'On' : 'Off'}
              </span>
            </SummaryRow>

            <SummaryRow
              icon={<Users className="h-4 w-4 text-zinc-400" />}
              label="Mentor chain"
              last
            >
              <span className="text-sm font-medium text-white">
                {autoAssignMentorChain ? (
                  <>
                    On <span className="text-zinc-500">— routing L0/L1 to senior maintainers</span>
                  </>
                ) : (
                  <span className="text-zinc-500">Off</span>
                )}
              </span>
            </SummaryRow>
          </div>

          <div className="mt-10 flex w-full flex-col gap-3 sm:flex-row">
            <Link
              href="/maintainer"
              className="flex-1 rounded-md bg-neon-green px-5 py-3.5 text-center font-medium text-black"
            >
              Go to dashboard
            </Link>
            <Link
              href="/onboarding/repos"
              className="flex-1 rounded-md border border-zinc-700 px-5 py-3.5 text-center font-medium text-white"
            >
              Adjust repos
            </Link>
          </div>
        </div>
      </section>
      <footer className="relative z-[1] mt-auto w-full border-t border-white/10 px-12 py-8">
        <div className="mx-auto flex max-w-[1200px] items-center justify-between">
          <div className="text-[0.82rem] leading-[1.4] text-zinc-500">
            © 2026 MergeShip. <span className="text-zinc-400">Built for performance.</span>
          </div>

          <div className="flex items-center gap-6">
            <Link
              href="/docs"
              className="text-[0.82rem] text-zinc-500 no-underline transition-colors duration-200 hover:text-white"
            >
              Read the docs
            </Link>

            {/*Watch a 2 min demo video link space */}

            <Link
              href="https://discord.gg/Wg4xZt3DRx"
              className="text-[0.82rem] text-zinc-500 no-underline transition-colors duration-200 hover:text-white"
            >
              Join our Discord
            </Link>
          </div>
        </div>
      </footer>
    </main>
  );
}

type SummaryRowProps = {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  last?: boolean;
  children: React.ReactNode;
};

function SummaryRow({ icon, label, badge, last, children }: SummaryRowProps) {
  return (
    <div
      className={`flex items-center justify-between gap-4 px-5 py-4 ${
        last ? '' : 'border-b border-zinc-800/60'
      }`}
    >
      <div className="flex items-center gap-2.5">
        {icon}
        <span className="text-sm text-zinc-300">{label}</span>
        {badge && (
          <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-[11px] font-medium tabular-nums text-zinc-300">
            {badge}
          </span>
        )}
      </div>
      <div className="min-w-0 max-w-[55%] text-right">{children}</div>
    </div>
  );
}
