import Link from 'next/link';
import { redirect } from 'next/navigation';
import { CheckCircle2 } from 'lucide-react';
import { getServerSupabase } from '@/lib/supabase/server';
import { listMaintainerInstalls } from '@/lib/maintainer/detect';
import { getRepoPicker, getInstallationSettings } from '@/app/actions/maintainer';
import CompletionSummaryCard from './completion-summary-card';

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

        <CompletionSummaryCard
          managedNames={managedNames}
          autoAssignMentorChain={autoAssignMentorChain}
        />

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
