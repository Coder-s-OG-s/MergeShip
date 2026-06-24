import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2, GitBranch, ShieldCheck, Users } from 'lucide-react';
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

  const managedRepos = repoRes.ok ? repoRes.data.filter((r) => r.managed) : [];
  const managedNames = managedRepos.map((r) => r.repoFullName);
  const autoAssignMentorChain = settingsRes.ok ? settingsRes.data.autoAssignMentorChain : false;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#0D0E12] px-6 py-16 text-white">
      <section className="flex w-full max-w-xl flex-col items-center text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neon-green/15">
          <CheckCircle2 className="h-9 w-9 text-neon-green" strokeWidth={2.5} />
        </div>

        <h1 className="mt-6 text-3xl font-bold md:text-4xl">
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
            <span className="text-sm text-zinc-500">Not configured yet</span>
          </SummaryRow>

          <SummaryRow icon={<Users className="h-4 w-4 text-zinc-400" />} label="Mentor chain" last>
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
      </section>
    </main>
  );
}

function SummaryRow({
  icon,
  label,
  badge,
  last,
  children,
}: {
  icon: React.ReactNode;
  label: string;
  badge?: string;
  last?: boolean;
  children: React.ReactNode;
}) {
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
