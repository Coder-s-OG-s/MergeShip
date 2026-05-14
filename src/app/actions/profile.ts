'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';
import { ok, err, type Result } from '@/lib/result';

type BootstrapOutput = {
  profileId: string;
  githubHandle: string;
  githubId: string;
  auditQueued: boolean;
};

/**
 * Idempotent profile bootstrap. Called on first dashboard load post-OAuth.
 * Pulls identity from Supabase auth, mirrors into profiles, fires the audit event.
 *
 * Safe to call repeatedly — UPSERTs profile and only fires audit if not yet completed.
 */
export async function bootstrapProfile(): Promise<Result<BootstrapOutput>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'auth not configured on this deployment');

  const {
    data: { user },
    error: userErr,
  } = await sb.auth.getUser();

  if (userErr || !user) return err('not_authenticated', 'sign in first');

  const identity = user.identities?.find((i) => i.provider === 'github');
  if (!identity) return err('no_github_identity', 'GitHub OAuth required');

  const githubId = String(identity.id);
  const githubHandle = (identity.identity_data?.['user_name'] ??
    identity.identity_data?.['preferred_username']) as string | undefined;
  if (!githubHandle) return err('no_github_handle', 'GitHub handle missing from identity');

  const avatarUrl = identity.identity_data?.['avatar_url'] as string | undefined;
  const displayName = (identity.identity_data?.['name'] ??
    identity.identity_data?.['full_name']) as string | undefined;

  // Use service role for the UPSERT — RLS would block users from inserting their own row.
  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'service role not configured');

  const { data: profile, error: upsertErr } = await service
    .from('profiles')
    .upsert(
      {
        id: user.id,
        github_id: githubId,
        github_handle: githubHandle,
        avatar_url: avatarUrl ?? null,
        display_name: displayName ?? null,
      },
      { onConflict: 'id' },
    )
    .select('id, github_handle, audit_completed')
    .single();

  if (upsertErr || !profile) {
    return err('persist_failed', upsertErr?.message ?? 'profile upsert returned nothing');
  }

  let auditQueued = false;
  if (!profile.audit_completed) {
    const providerToken = (await sb.auth.getSession()).data.session?.provider_token;
    if (providerToken) {
      await inngest.send({
        name: 'audit/run',
        data: {
          userId: profile.id,
          githubHandle: profile.github_handle,
          githubId,
          accessToken: providerToken,
        },
      });
      auditQueued = true;
    }
  }

  // Fire-and-forget maintainer discovery so this user picks up admin
  // permissions across every install (including orgs where they were
  // added as admin after a different teammate created the install).
  // Idempotent + Redis-deduped at 1h.
  void inngest.send({
    name: 'maintainer/discover',
    data: { userId: profile.id, githubHandle: profile.github_handle },
  });

  return ok({
    profileId: profile.id,
    githubHandle: profile.github_handle,
    githubId,
    auditQueued,
  });
}
