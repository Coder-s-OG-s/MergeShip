-- supabase/migrations/0005_github_stats.sql
-- Add GitHub-synced stat columns to profiles and create github_prs cache table.

set search_path to public;

alter table profiles
  add column if not exists github_total_merges   integer,
  add column if not exists github_streak         integer,
  add column if not exists github_stats_synced_at timestamptz;

create table if not exists github_prs (
  id             text        primary key,
  user_id        uuid        not null references profiles(id) on delete cascade,
  title          text        not null,
  repo_full_name text        not null,
  state          text        not null check (state in ('open', 'closed', 'merged')),
  pr_number      integer     not null,
  pr_url         text        not null,
  opened_at      timestamptz not null
);

create index if not exists github_prs_user_state on github_prs (user_id, state);
