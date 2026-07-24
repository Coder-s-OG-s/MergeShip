-- Issue #607: restrict installation_settings RLS to org_admin / repo_admin only.
-- Previously, any maintainer (including repo_maintain) could modify global settings.
-- Renumbered from 0032 -> 0040: this file shared the 0032 prefix with
-- 0032_pr_review_pipeline.sql, which broke `supabase db reset` for contributors.

drop policy if exists installation_settings_maintainer_rw on installation_settings;

create policy installation_settings_admin_rw on installation_settings
  for all
  using (
    exists (
      select 1
      from github_installation_users giu
      where giu.installation_id = installation_settings.installation_id
        and giu.user_id = auth.uid()
        and giu.permission_level in ('org_admin', 'repo_admin')
    )
  )
  with check (
    exists (
      select 1
      from github_installation_users giu
      where giu.installation_id = installation_settings.installation_id
        and giu.user_id = auth.uid()
        and giu.permission_level in ('org_admin', 'repo_admin')
    )
  );
