import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';

/**
 * GitHub App installation lifecycle:
 *  - installation.created → record install row, link to user via account_login
 *  - installation.deleted → mark uninstalled_at (gate flips back on for that user)
 *  - installation.suspend / unsuspend → toggle suspended_at
 *  - installation_repositories.added/removed → maintain installation_repositories rows
 */

type InstallationPayload = {
  action: 'created' | 'deleted' | 'suspend' | 'unsuspend' | string;
  installation: {
    id: number;
    account: { login: string; type: 'User' | 'Organization' };
    repository_selection: 'all' | 'selected';
  };
  repositories?: Array<{ full_name: string }>;
};

export const processInstallationEvent = inngest.createFunction(
  {
    id: 'process-installation-event',
    concurrency: { key: 'event.data.payload.installation.id', limit: 1 },
  },
  { event: 'github/installation' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: InstallationPayload }).payload;
    return await step.run('handle-installation', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      const install = payload.installation;

      if (payload.action === 'created') {
        // Try to resolve account_login → profile. If no profile yet (user
        // installed before signing in, or webhook beat the OAuth callback's
        // bootstrap), store the row with user_id = null. /install will
        // back-link it on the user's next visit.
        const { data: profile } = await sb
          .from('profiles')
          .select('id')
          .eq('github_handle', install.account.login)
          .maybeSingle();

        await sb.from('github_installations').upsert({
          id: install.id,
          user_id: profile?.id ?? null,
          account_login: install.account.login,
          account_type: install.account.type,
          repository_selection: install.repository_selection,
        });

        if (payload.repositories) {
          await sb.from('installation_repositories').insert(
            payload.repositories.map((r) => ({
              installation_id: install.id,
              repo_full_name: r.full_name,
            })),
          );
        }
        return { ok: true, linked: Boolean(profile) };
      }

      if (payload.action === 'deleted') {
        await sb
          .from('github_installations')
          .update({ uninstalled_at: new Date().toISOString() })
          .eq('id', install.id);
        return { ok: true, uninstalled: true };
      }

      if (payload.action === 'suspend') {
        await sb
          .from('github_installations')
          .update({ suspended_at: new Date().toISOString() })
          .eq('id', install.id);
        return { ok: true, suspended: true };
      }

      if (payload.action === 'unsuspend') {
        await sb.from('github_installations').update({ suspended_at: null }).eq('id', install.id);
        return { ok: true, unsuspended: true };
      }

      return { skipped: true, action: payload.action };
    });
  },
);

type InstallationReposPayload = {
  action: 'added' | 'removed' | string;
  installation: { id: number };
  repositories_added?: Array<{ full_name: string }>;
  repositories_removed?: Array<{ full_name: string }>;
};

export const processInstallationReposEvent = inngest.createFunction(
  {
    id: 'process-installation-repos-event',
    concurrency: { key: 'event.data.payload.installation.id', limit: 1 },
  },
  { event: 'github/installation_repositories' },
  async ({ event, step }) => {
    const payload = (event.data as { payload: InstallationReposPayload }).payload;
    return await step.run('handle-repo-change', async () => {
      const sb = getServiceSupabase();
      if (!sb) throw new Error('service role missing');

      if (payload.repositories_added?.length) {
        await sb.from('installation_repositories').insert(
          payload.repositories_added.map((r) => ({
            installation_id: payload.installation.id,
            repo_full_name: r.full_name,
          })),
        );
      }
      if (payload.repositories_removed?.length) {
        const removed = payload.repositories_removed.map((r) => r.full_name);
        await sb
          .from('installation_repositories')
          .delete()
          .eq('installation_id', payload.installation.id)
          .in('repo_full_name', removed);
      }
      return { ok: true };
    });
  },
);
