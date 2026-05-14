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

  // Use service role for the install lookup. RLS would also work, but the
  // user-scoped client can miss rows during the brief window when the
  // session cookie is being refreshed by middleware, leaving users stuck
  // on this page despite a perfectly good install row. Bypass by going
  // straight to the source of truth.
  const service = getServiceSupabase();
  if (service && bootstrap?.ok) {
    // Use limit(1) instead of maybeSingle() — duplicate active rows are
    // possible when GitHub issues a new installation_id without deleting
    // the previous one (reinstalls after the old row was force-reactivated).
    // maybeSingle() would error and fall through, leaving the user stuck.

    // 1. Already linked to this user → straight to dashboard.
    const { data: linkedRows } = await service
      .from('github_installations')
      .select('id')
      .eq('user_id', user.id)
      .is('uninstalled_at', null)
      .order('installed_at', { ascending: false })
      .limit(1);
    if (linkedRows && linkedRows.length > 0) redirect('/dashboard');

    // 2. Row exists by account_login but user_id is null or stale → link it
    //    to the current user. Covers orphans from pre-bootstrap webhooks and
    //    accounts that re-authed under a new auth.users.id.
    const { data: byHandleRows } = await service
      .from('github_installations')
      .select('id, user_id')
      .eq('account_login', bootstrap.data.githubHandle)
      .is('uninstalled_at', null)
      .order('installed_at', { ascending: false })
      .limit(1);
    const byHandle = byHandleRows?.[0];
    if (byHandle) {
      if (byHandle.user_id !== user.id) {
        await service
          .from('github_installations')
          .update({ user_id: user.id })
          .eq('id', byHandle.id);

        // Junction row for the back-linked user. Treat them as the install
        // creator since their handle matches the install's account.
        await service.from('github_installation_users').upsert(
          {
            installation_id: byHandle.id,
            user_id: user.id,
            permission_level: 'org_admin',
            source: 'install_creator',
            verified_at: new Date().toISOString(),
          },
          { onConflict: 'installation_id,user_id' },
        );

        // Fire audit now that the link exists. Idempotent.
        const { inngest } = await import('@/inngest/client');
        await inngest.send({
          name: 'audit/run',
          data: {
            userId: user.id,
            githubHandle: bootstrap.data.githubHandle,
            githubId: bootstrap.data.githubId,
            installationId: byHandle.id,
          },
        });
      }
      redirect('/dashboard');
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
