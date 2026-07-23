import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { listMaintainerInstalls } from '@/lib/maintainer/detect';
import { getRepoPicker, getInstallationSettings } from '@/app/actions/maintainer';
import { RepoPicker } from './repo-picker';
import { QueueSettings } from './queue-settings';

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
  // Surface a load failure via the nearest error boundary rather than silently
  // rendering an empty list that strands the user on a disabled button.
  if (!res.ok) throw new Error(`Failed to load repos: ${res.error.message}`);
  const repos = res.data;

  const settingsRes = await getInstallationSettings(install.installationId);
  if (!settingsRes.ok) throw new Error(`Failed to load queue settings: ${settingsRes.error.message}`);
  const settings = settingsRes.data;

  return (
    <main className="flex min-h-screen justify-center bg-[#0D0E12] px-6 py-16 text-white">
      <div className="flex w-full max-w-5xl flex-col lg:flex-row gap-12">
        <div className="flex-1">
          <RepoPicker installationId={install.installationId} initialRepos={repos} />
        </div>
        <div className="flex-1">
          <QueueSettings installationId={install.installationId} initialSettings={settings} />
        </div>
      </div>
    </main>
  );
}
