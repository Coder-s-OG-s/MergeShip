import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getContributorsList,
  getContributorStats,
  listPendingInvites,
  type ContributorListRow,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { isOk } from '@/lib/result';
import { ContributorsTable } from './contributors-table';

import { LevelDistributionPanel } from './level-distribution-panel';
import { buildTrustSegments } from '@/lib/maintainer/trust';
import { TrustSegmentsPanel } from './trust-segments-panel';
import ExportContributorsButton from './export-contributors-button';
import { StatsBar } from './stats-bar';
import { PendingInvitesPanel } from './pending-invites-panel';

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
  const trustScores = contributors.map((c) => c.trustScore);
  const trustSegments = buildTrustSegments(trustScores);
  const install = installs.find((i) => i.installationId === installId)!;

  const repos = await listMaintainerRepos(user.id, installId);

  const statsRes = await getContributorStats(installId);
  const stats = isOk(statsRes)
    ? statsRes.data
    : { total: 0, active: 0, l2Plus: 0, joinedLast7d: 0, avgTrust: 0, pendingInvites: 0 };

  const invitesRes = await listPendingInvites(installId);
  const pendingInvites = isOk(invitesRes) ? invitesRes.data : [];

  return (
    <div className="min-h-screen bg-zinc-950 px-6 py-12 text-white">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-3xl font-bold">Contributors</h1>
            <p className="mt-2 text-sm text-zinc-400">
              Contributors active across{' '}
              <span className="text-zinc-300">{install.accountLogin}</span> repos.
            </p>
          </div>
          <ExportContributorsButton installationId={installId} />
        </div>

        <StatsBar stats={stats} />
        <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-4">
          <div className="lg:col-span-3">
            <ContributorsTable
              installationId={installId}
              isOrganization={install.accountType === 'Organization'}
              initialContributors={contributors}
              repos={repos}
            />
          </div>
          <div className="flex flex-col gap-8 lg:col-span-1">
            <LevelDistributionPanel contributors={contributors} />
            <TrustSegmentsPanel segments={trustSegments} total={contributors.length} />
            <PendingInvitesPanel invites={pendingInvites} installationId={installId} />
          </div>
        </div>
      </div>
    </div>
  );
}
