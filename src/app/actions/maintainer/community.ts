'use server';

import { ok, err, type Result } from '@/lib/result';
import { requireMaintainer } from '@/lib/action-auth';
import { RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { validateCommunityUrl, type CommunityKind } from '@/lib/maintainer/community';
import { type CommunityLink } from './types';

export async function getCommunityLinks(installationId: number): Promise<Result<CommunityLink[]>> {
  const authRes = await requireMaintainer({
    requireService: true,
    rateLimit: { namespace: 'maint:community-links', ...RATE_LIMIT_TIERS.GENEROUS },
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', user.id)
    .eq('installation_id', installationId)
    .maybeSingle();
  if (!junction) return err('not_authorised', 'not your install');

  const { data } = await service
    .from('org_communities')
    .select('id, installation_id, kind, url, label, updated_at')
    .eq('installation_id', installationId)
    .order('kind');

  return ok(
    (data ?? []).map((r) => ({
      id: r.id,
      installationId: r.installation_id,
      kind: r.kind as CommunityKind,
      url: r.url,
      label: r.label,
      updatedAt: r.updated_at,
    })),
  );
}

export async function upsertCommunityLink(input: {
  installationId: number;
  kind: CommunityKind;
  url: string;
  label?: string;
}): Promise<Result<{ id: number }>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Confirm the install is one the user maintains.
  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', user.id)
    .eq('installation_id', input.installationId)
    .maybeSingle();
  if (!junction) return err('not_authorised', 'not your install');

  const validated = validateCommunityUrl(input.url, input.kind);
  if (!validated.ok) return err('invalid_url', validated.reason);

  const { data, error } = await service
    .from('org_communities')
    .upsert(
      {
        installation_id: input.installationId,
        kind: input.kind,
        url: validated.url,
        label: input.label ?? null,
        created_by_user_id: user.id,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'installation_id,kind' },
    )
    .select('id')
    .single();
  if (error || !data) return err('persist_failed', error?.message ?? 'upsert failed');

  return ok({ id: data.id });
}

export async function deleteCommunityLink(linkId: number): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({ requireService: true });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  // Find link + verify install belongs to user.
  const { data: link } = await service
    .from('org_communities')
    .select('installation_id')
    .eq('id', linkId)
    .maybeSingle();
  if (!link) return err('not_found', 'link not found');

  const { data: junction } = await service
    .from('github_installation_users')
    .select('installation_id')
    .eq('user_id', user.id)
    .eq('installation_id', link.installation_id)
    .maybeSingle();
  if (!junction) return err('not_authorised', 'not your install');

  await service.from('org_communities').delete().eq('id', linkId);
  return ok({ ok: true });
}
