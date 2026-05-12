import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { redirect } from 'next/navigation';
import { bootstrapProfile } from '@/app/actions/profile';

export const dynamic = 'force-dynamic';

/**
 * Install gate page. Shown when a signed-in user hasn't installed the MergeShip
 * GitHub App on their account yet. One click sends them to GitHub's install flow;
 * the App's installation.created webhook records the install and unblocks them.
 */
export default async function InstallPage() {
  const sb = getServerSupabase();
  if (!sb) {
    return <NotConfiguredNotice />;
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) redirect('/');

  // Idempotent — makes sure a profile row exists so the install webhook can
  // resolve account_login → user_id. Quietly no-ops if already bootstrapped.
  const bootstrap = await bootstrapProfile().catch(() => null);

  // If they already have an active install, skip the gate.
  const { data: existing } = await sb
    .from('github_installations')
    .select('id')
    .eq('user_id', user.id)
    .is('uninstalled_at', null)
    .maybeSingle();

  if (existing) redirect('/onboarding');

  // Back-link orphan installations: if the user installed before their profile
  // row existed, the webhook handler stashed nothing. Recover by matching
  // account_login → github_handle. Uses service role to bypass RLS on the
  // installation table.
  if (bootstrap?.ok) {
    const service = getServiceSupabase();
    if (service) {
      const { data: orphan } = await service
        .from('github_installations')
        .select('id')
        .eq('account_login', bootstrap.data.githubHandle)
        .is('user_id', null)
        .is('uninstalled_at', null)
        .maybeSingle();
      if (orphan) {
        await service.from('github_installations').update({ user_id: user.id }).eq('id', orphan.id);
        redirect('/onboarding');
      }
    }
  }

  const slug = process.env.GITHUB_APP_SLUG ?? 'mergeship';
  const installUrl = `https://github.com/apps/${slug}/installations/new`;

  return (
    <div className="hero-bg grid-bg min-h-screen px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-display text-4xl font-bold">One more step</h1>
        <p className="mb-6 text-gray-300">
          MergeShip needs the GitHub App installed on your account so it can track your
          contributions and award XP in real time. Two clicks, no permissions you don&apos;t already
          have on GitHub.
        </p>

        <Link
          href={installUrl}
          className="btn-primary inline-flex items-center gap-2 rounded-xl px-6 py-3 font-semibold"
        >
          Install MergeShip on GitHub
        </Link>

        <p className="mt-8 text-sm text-gray-500">
          We only ask for read access to your repos and write access on issues you&apos;re working
          on. You can revoke it any time in GitHub settings.
        </p>
      </div>
    </div>
  );
}

function NotConfiguredNotice() {
  return (
    <div className="min-h-screen px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-display text-3xl font-bold">Service not configured</h1>
        <p className="text-gray-400">
          Auth is not wired up on this deployment yet. Check back soon.
        </p>
      </div>
    </div>
  );
}
