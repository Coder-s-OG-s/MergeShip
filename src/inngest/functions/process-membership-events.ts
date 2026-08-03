import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

/**
 * Handle org-membership + repo-collaborator changes so maintainer-discover
 * runs in real time when permissions change on the GitHub side.
 *
 * Subscribed events:
 *   - membership.added / membership.removed (org)
 *   - member.added / member.edited / member.removed (repo collaborator)
 */

type MembershipPayload = {
  action: 'added' | 'removed' | string;
  scope?: 'team';
  member?: { login: string };
  organization?: { login: string };
};

export const processMembershipEvent = inngest.createFunction(
  {
    id: 'process-membership-event',
    concurrency: { key: 'event.data.payload.member.login', limit: 1 },
  },
  { event: 'github/membership' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: MembershipPayload }).payload;
    if (!payload.member?.login) return { skipped: true, reason: 'no_member' };

    return await step.run('discover-for-member', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true };

      // Find the MergeShip user (if any) for this GitHub handle.
      const { data: profile } = await sb
        .from('profiles')
        .select('id, github_handle')
        .eq('github_handle', payload.member!.login)
        .maybeSingle();
      if (!profile) return { skipped: true, reason: 'not_a_user' };

      // Resolve the installation for this org so maintainer-discover can
      // discover the new grant even if the user isn't in the junction table yet.
      let installationId: number | undefined;
      if (payload.organization?.login) {
        const { data: install } = await sb
          .from('github_installations')
          .select('id')
          .eq('account_login', payload.organization.login)
          .eq('account_type', 'Organization')
          .is('uninstalled_at', null)
          .maybeSingle();
        if (install) installationId = install.id;
      }

      await inngest.send({
        name: 'maintainer/discover',
        data: {
          userId: profile.id,
          githubHandle: profile.github_handle,
          force: true,
          ...(installationId !== undefined ? { installationId } : {}),
        },
      });
      return { ok: true, action: payload.action };
    });
  },
);

type MemberPayload = {
  action: 'added' | 'edited' | 'removed' | string;
  member?: { login: string };
  repository?: { full_name: string };
};

export const processMemberEvent = inngest.createFunction(
  { id: 'process-member-event', concurrency: { key: 'event.data.payload.member.login', limit: 1 } },
  { event: 'github/member' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: MemberPayload }).payload;
    if (!payload.member?.login) return { skipped: true, reason: 'no_member' };
    if (!payload.repository?.full_name) return { skipped: true, reason: 'no_repo' };

    return await step.run('discover-for-collaborator', async () => {
      const sb = getServiceSupabase();
      if (!sb) return { skipped: true };

      // Only fire discover if the repo is in any of our installs — otherwise
      // we don't care about this collaborator.
      const { data: repoMatch } = await sb
        .from('installation_repositories')
        .select('installation_id')
        .eq('repo_full_name', payload.repository!.full_name)
        .limit(1)
        .maybeSingle();
      if (!repoMatch) return { skipped: true, reason: 'repo_not_in_install' };

      const { data: profile } = await sb
        .from('profiles')
        .select('id, github_handle')
        .eq('github_handle', payload.member!.login)
        .maybeSingle();
      if (!profile) return { skipped: true, reason: 'not_a_user' };

      await inngest.send({
        name: 'maintainer/discover',
        data: {
          userId: profile.id,
          githubHandle: profile.github_handle,
          force: true,
          installationId: repoMatch.installation_id,
        },
      });
      return { ok: true, action: payload.action };
    });
  },
);
