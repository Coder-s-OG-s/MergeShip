import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { listMaintainerInstalls } from '@/lib/maintainer/detect';
import { getRepoPicker } from '@/app/actions/maintainer';
import { RepoPicker } from './repo-picker';

export const dynamic = 'force-dynamic';

/**
 * Maintainer onboarding step 2 — the repo picker. Resolves the signed-in
 * maintainer's first install and lets them choose which repos MergeShip
 * manages. The full step-2 shell (queue settings) is tracked separately
 * in #326; this page hosts the picker piece (#328).
 */
export default async function OnboardingReposPage() {
  const sb = await getServerSupabase();
  if (!sb) redirect('/');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const installs = await listMaintainerInstalls(user.id);
  const install = installs[0];
  if (!install) redirect('/install');

  const res = await getRepoPicker(install.installationId);
  const repos = res.ok ? res.data : [];

  return (
    <main className="flex min-h-screen justify-center bg-[#0D0E12] px-6 py-16 text-white">
      <RepoPicker installationId={install.installationId} initialRepos={repos} />
    </main>
  );
}
