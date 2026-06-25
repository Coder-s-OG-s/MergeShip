'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { inngest } from '@/inngest/client';
import { rateLimit, RATE_LIMIT_TIERS } from '@/lib/rate-limit';
import { ok, err, type Result } from '@/lib/result';
import { revalidatePath } from 'next/cache';
import { z } from 'zod';

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
  const sb = await getServerSupabase();
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
    .select('id, github_handle, audit_completed, github_stats_synced_at')
    .single();

  if (upsertErr || !profile) {
    return err('persist_failed', upsertErr?.message ?? 'profile upsert returned nothing');
  }

  // Upsert the user's email into the private profile_emails table
  if (user.email) {
    const { error: emailErr } = await service.from('profile_emails').upsert(
      {
        user_id: user.id,
        email: user.email,
      },
      { onConflict: 'user_id' },
    );

    if (emailErr) {
      console.error('Failed to upsert profile email', emailErr);
    }
  }

  let auditQueued = false;

  if (!profile.audit_completed) {
    // Look up an active GitHub App installation for this user. The audit
    // function uses the installation token to call the GitHub API, so we
    // pass only the installation ID here. OAuth tokens must never travel
    // through Inngest because the event payload is retained in third-party
    // infrastructure (Inngest's cloud event log) for replay and debugging.
    //
    // If no installation exists yet, the install webhook handler fires its
    // own audit/run event with the installationId once the user installs the
    // app, so nothing is lost.
    const { data: install } = await service
      .from('github_installations')
      .select('id')
      .eq('user_id', profile.id)
      .is('uninstalled_at', null)
      .order('installed_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (install?.id) {
      await inngest.send({
        name: 'audit/run',
        data: {
          userId: profile.id,
          githubHandle: profile.github_handle,
          githubId,
          installationId: install.id,
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

  if (!profile.github_stats_synced_at) {
    await inngest.send({
      name: 'github/stats-sync',
      data: { userId: profile.id, githubHandle: profile.github_handle },
    });
  }

  return ok({
    profileId: profile.id,
    githubHandle: profile.github_handle,
    githubId,
    auditQueued,
  });
}

/**
 * Updates or clears the user's mute preferences.
 * Pass empty arrays to clear preferences.
 */
export async function updateMutePreferences(
  mutedRepos: string[],
  mutedLanguages: string[],
): Promise<Result<void>> {
  const sb = await getServerSupabase();

  if (!sb) {
    return err('not_configured', 'auth not configured');
  }

  const {
    data: { user },
  } = await sb.auth.getUser();

  if (!user) {
    return err('not_authenticated', 'sign in first');
  }

  const rateRes = await rateLimit({
    namespace: 'profile:mute',
    key: user.id,
    ...RATE_LIMIT_TIERS.STRICT,
  });

  if (!rateRes.ok) {
    return err('rate_limited', 'slow down', true);
  }

  const service = getServiceSupabase();

  if (!service) {
    return err('not_configured', 'service role not configured');
  }

  const { error: updateErr } = await service
    .from('profiles')
    .update({
      muted_repos: mutedRepos,
      muted_languages: mutedLanguages,
    })
    .eq('id', user.id);

  if (updateErr) {
    return err('persist_failed', updateErr.message);
  }

  return ok(undefined);
}

// ============================================================================
// Profile Update Action
// ============================================================================

// Validation schema for profile updates
const profileUpdateSchema = z.object({
  bio: z.string().max(280, 'Bio must be 280 characters or less').optional().nullable(),

  skills: z.array(z.string()).max(10, 'Maximum 10 skills allowed').optional().nullable(),

  website_url: z.string().url('Please enter a valid URL').optional().nullable().or(z.literal('')),

  twitter_handle: z
    .string()
    .regex(/^[A-Za-z0-9_]{1,15}$/, 'Invalid Twitter handle (no @ symbol, max 15 chars)')
    .optional()
    .nullable()
    .or(z.literal('')),
});

export type ProfileUpdateData = z.infer<typeof profileUpdateSchema>;

/**
 * Update user profile information (bio, skills, social links)
 */
export async function updateProfile(data: ProfileUpdateData): Promise<Result<{ message: string }>> {
  const sb = await getServerSupabase();

  if (!sb) {
    return err('not_configured', 'Authentication not configured');
  }

  const {
    data: { user },
    error: authError,
  } = await sb.auth.getUser();

  if (authError || !user) {
    return err('not_authenticated', 'You must be logged in to update your profile');
  }

  // Rate limit: 10 updates per 60 seconds per user
  const rateLimitResult = await rateLimit({
    namespace: 'profile:update',
    key: user.id,
    ...RATE_LIMIT_TIERS.STRICT,
  });

  if (!rateLimitResult.ok) {
    return err('rate_limited', 'Too many profile updates. Please try again later.');
  }

  // Validate the input data
  const validation = profileUpdateSchema.safeParse(data);

  if (!validation.success) {
    return err('validation_failed', JSON.stringify(validation.error.flatten().fieldErrors));
  }

  const validatedData = validation.data;

  // Clean up the data (convert empty strings to null)
  const cleanData = {
    bio: validatedData.bio || null,
    skills: validatedData.skills || [],
    website_url: validatedData.website_url || null,
    twitter_handle: validatedData.twitter_handle || null,
    updated_at: new Date().toISOString(),
  };

  // Update the profile in the database
  const { error: updateError } = await sb.from('profiles').update(cleanData).eq('id', user.id);

  if (updateError) {
    return err('update_failed', updateError.message || 'Failed to update profile');
  }

  // Revalidate relevant pages so changes show immediately
  revalidatePath('/settings/profile');

  // Get the user's GitHub handle for profile path revalidation
  const { data: profile } = await sb
    .from('profiles')
    .select('github_handle')
    .eq('id', user.id)
    .single();

  if (profile?.github_handle) {
    revalidatePath(`/@${profile.github_handle}`);
  }

  return ok({ message: 'Profile updated successfully!' });
}
