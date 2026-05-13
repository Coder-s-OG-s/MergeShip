import { inngest } from '../client';
import { getServiceSupabase } from '@/lib/supabase/service';
import { getInstallOctokit } from '@/lib/github/app';

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

        // Mark any prior active installs on the same account as superseded.
        // GitHub issues a fresh installation_id on reinstall and will only
        // send the delete webhook for the previous install once — if that
        // event is lost (rare, but happens) or arrives after the create,
        // we'd end up with two rows that both look active. Lookup paths use
        // maybeSingle and break in that state.
        await sb
          .from('github_installations')
          .update({ uninstalled_at: new Date().toISOString() })
          .eq('account_login', install.account.login)
          .is('uninstalled_at', null)
          .neq('id', install.id);

        await sb.from('github_installations').upsert({
          id: install.id,
          user_id: profile?.id ?? null,
          account_login: install.account.login,
          account_type: install.account.type,
          repository_selection: install.repository_selection,
          uninstalled_at: null,
          suspended_at: null,
        });

        // GitHub only includes `repositories` in the payload when the user
        // picked "Selected repositories". For "All repositories" installs the
        // array is omitted — we have to ask the API. Either way, normalize to
        // the same set of installation_repositories rows.
        let repos: Array<{ full_name: string }> = payload.repositories ?? [];
        if (repos.length === 0) {
          try {
            const octokit = await getInstallOctokit(install.id);
            const res = await octokit.paginate(octokit.apps.listReposAccessibleToInstallation, {
              per_page: 100,
            });
            repos = (res as unknown as Array<{ full_name: string }>).map((r) => ({
              full_name: r.full_name,
            }));
          } catch {
            // Best-effort. issues-sweep will re-attempt to discover repos later.
          }
        }
        if (repos.length > 0) {
          await sb.from('installation_repositories').upsert(
            repos.map((r) => ({
              installation_id: install.id,
              repo_full_name: r.full_name,
            })),
            { onConflict: 'installation_id,repo_full_name' },
          );
        }

        // Trigger audit now that we have a linked user and a fresh install
        // token. audit-run is idempotent — if it already ran (e.g. via the
        // bootstrap path), the profile.audit_completed short-circuit kicks in.
        if (profile) {
          const { data: profileRow } = await sb
            .from('profiles')
            .select('github_handle, github_id')
            .eq('id', profile.id)
            .maybeSingle();
          if (profileRow) {
            await inngest.send({
              name: 'audit/run',
              data: {
                userId: profile.id,
                githubHandle: profileRow.github_handle,
                githubId: profileRow.github_id,
                installationId: install.id,
              },
            });
          }
        }

        return { ok: true, linked: Boolean(profile), repoCount: repos.length };
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
