-- Round-robin rotation for the bounded issues-sweep (#860 / #865).
-- The sweep orders installs and repos by least-recently-swept and updates
-- this column after processing, so every install/repo rotates through the
-- per-run caps instead of the same top-N being swept every run.
alter table github_installations
  add column if not exists last_swept_at timestamptz;

alter table installation_repositories
  add column if not exists last_swept_at timestamptz;

create index if not exists github_installations_last_swept_idx
  on github_installations (last_swept_at);

create index if not exists installation_repositories_last_swept_idx
  on installation_repositories (installation_id, last_swept_at);
