import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getCommunityLinks,
  type MaintainerInstall,
  type CommunityLink,
} from '@/app/actions/maintainer';
import { COMMUNITY_KINDS } from '@/lib/maintainer/community';
import { isOk } from '@/lib/result';
import CommunityEditor from './editor';

export const dynamic = 'force-dynamic';

export default async function CommunicationsPage({
  searchParams,
}: {
  searchParams: { install?: string };
}) {
  const sb = getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');
  if (!(await isUserMaintainer(user.id))) redirect('/dashboard');

  const installsRes = await getMaintainerInstalls();
  const installs: MaintainerInstall[] = isOk(installsRes) ? installsRes.data : [];
  if (installs.length === 0) redirect('/maintainer');

  const installId =
    searchParams.install && installs.find((i) => i.installationId === Number(searchParams.install))
      ? Number(searchParams.install)
      : installs[0]!.installationId;

  const linksRes = await getCommunityLinks(installId);
  const links: CommunityLink[] = isOk(linksRes) ? linksRes.data : [];
  const install = installs.find((i) => i.installationId === installId)!;

  return (
    <div className="min-h-full bg-[#0d1117] p-8 text-white">
      <div className="mx-auto max-w-2xl">
        <div className="mb-8">
          <h1 className="text-3xl font-bold tracking-tight">Communications</h1>
          <p className="mt-1 text-[12px] text-[#8b949e]">
            Discord, Slack, forums — anywhere your community lives. Contributors who work in{' '}
            <span className="text-white">{install.accountLogin}</span> repos see these on their
            dashboard.
          </p>
        </div>
        <CommunityEditor
          installationId={installId}
          initialLinks={links}
          kinds={[...COMMUNITY_KINDS]}
        />
      </div>
    </div>
  );
}
