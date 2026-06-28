-- Issue #331: per-installation maintainer queue settings.
-- Stores settings separately from github_installations so the queue panel can grow.

create table if not exists installation_settings (
  installation_id bigint primary key
    references github_installations(id) on delete cascade,
  min_contributor_level integer not null default 0
    check (min_contributor_level between 0 and 3),
  updated_at timestamptz not null default now()
);

alter table installation_settings enable row level security;

do $$
begin
  if not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'installation_settings'
      and policyname = 'installation_settings_maintainer_rw'
  ) then
    create policy installation_settings_maintainer_rw on installation_settings
      for all
      using (
        exists (
          select 1
          from github_installation_users giu
          where giu.installation_id = installation_settings.installation_id
            and giu.user_id = auth.uid()
        )
      )
      with check (
        exists (
          select 1
          from github_installation_users giu
          where giu.installation_id = installation_settings.installation_id
            and giu.user_id = auth.uid()
        )
      );
  end if;
end
$$;
