import { redirect } from 'next/navigation';
import { getServerSupabase } from '@/lib/supabase/server';
import { isUserMaintainer } from '@/lib/maintainer/detect';
import {
  getMaintainerInstalls,
  getCommunityLinks,
  type CommunityLink,
} from '@/app/actions/maintainer';
import type { MaintainerInstall } from '@/lib/maintainer/detect';
import { COMMUNITY_KINDS } from '@/lib/maintainer/community';
import { isOk } from '@/lib/result';
import CommunityEditor from './editor';

export const dynamic = 'force-dynamic';

export default async function CommunityPage({
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

  const linksRes = await getCommunityLinks(installId);
  const links: CommunityLink[] = isOk(linksRes) ? linksRes.data : [];
  const install = installs.find((i) => i.installationId === installId)!;

  return (
    <div className="app-page">
      <div className="mx-auto max-w-2xl">
        <h1 className="font-display text-3xl font-bold">Community links</h1>
        <p className="mt-2 text-sm text-zinc-400">
          Discord, Slack, forums, anywhere your community lives. Contributors who work in{' '}
          <span className="text-zinc-300">{install.accountLogin}</span> repos see these on their
          dashboard.
        </p>
        <CommunityEditor
          installationId={installId}
          initialLinks={links}
          kinds={[...COMMUNITY_KINDS]}
        />
      </div>
    </div>
  );
}
