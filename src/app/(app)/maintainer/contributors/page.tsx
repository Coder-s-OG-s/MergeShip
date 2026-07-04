import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getContributorsList,
  type ContributorListRow,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import { ContributorsTable } from './contributors-table';

import { LevelDistributionPanel } from './level-distribution-panel';

export const dynamic = 'force-dynamic';

export default async function ContributorsPage({
  searchParams,
}: {
  searchParams: Promise<{ install?: string }>;
}) {
  const resolvedSearchParams = await searchParams;
  const sb = await getServerSupabase();
  if (!sb) return null;
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) redirect('/maintainer');

  const installId =
    resolvedSearchParams.install &&
    installs.find((i) => i.installationId === Number(resolvedSearchParams.install))
      ? Number(resolvedSearchParams.install)
      : installs[0]!.installationId;

  const contributorsRes = await getContributorsList(installId);
  const contributors: ContributorListRow[] = isOk(contributorsRes) ? contributorsRes.data : [];
  const install = installs.find((i) => i.installationId === installId)!;

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <h1 className="font-display text-3xl font-bold">Contributors</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Contributors active across <span className="text-zinc-300">{install.accountLogin}</span>{' '}
          repos.
        </p>
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <ContributorsTable
              installationId={installId}
              isOrganization={install.accountType === 'Organization'}
              initialContributors={contributors}
            />
          </div>
          <div className="lg:col-span-1">
            <LevelDistributionPanel contributors={contributors} />
          </div>
        </div>
      </div>
    </div>
  );
}
