-- Maintainer-side tables.
-- All new tables. Drops nothing. Touches no existing rows.
-- RLS: public read on the data tables (mirrors `issues` policy — PRs are
-- already public on GitHub). Junction + scope tables are service-role only.

-- ========================================================================
-- pull_requests — mirror of PRs the maintainer queue draws from.
-- ========================================================================

create table if not exists pull_requests (
  id                  bigserial primary key,
  github_pr_id        bigint not null unique,
  repo_full_name      text not null,
  number              int not null,
  title               text not null,
  body_excerpt        text,
  author_login        text not null,
  author_user_id      uuid references profiles(id) on delete set null,
  state               text not null check (state in ('open', 'closed', 'merged')),
  draft               boolean not null default false,
  url                 text not null,
  github_created_at   timestamptz not null,
  github_updated_at   timestamptz not null,
  merged_at           timestamptz,
  closed_at           timestamptz,
  mentor_verified     boolean not null default false,
  mentor_reviewer_id  uuid references profiles(id) on delete set null,
  mentor_review_at    timestamptz,
  fetched_at          timestamptz not null default now(),
  unique (repo_full_name, number)
);

create index if not exists pull_requests_repo_state_idx
  on pull_requests (repo_full_name, state, github_updated_at desc);
create index if not exists pull_requests_author_idx
  on pull_requests (author_user_id, state);
create index if not exists pull_requests_mentor_verified_idx
  on pull_requests (mentor_verified, github_updated_at desc)
  where mentor_verified = true;

alter table pull_requests enable row level security;
drop policy if exists pull_requests_read_all on pull_requests;
create policy pull_requests_read_all on pull_requests for select using (true);
-- writes: service-role only

-- ========================================================================
-- pull_request_reviews — every review we've seen.
-- ========================================================================

create table if not exists pull_request_reviews (
  id                bigserial primary key,
  pr_id             bigint not null references pull_requests(id) on delete cascade,
  github_review_id  bigint not null unique,
  reviewer_login    text not null,
  reviewer_user_id  uuid references profiles(id) on delete set null,
  state             text not null check (state in ('approved', 'changes_requested', 'commented', 'dismissed', 'pending')),
  body_excerpt      text,
  is_mentor         boolean not null default false,
  submitted_at      timestamptz not null
);

create index if not exists pull_request_reviews_pr_mentor_idx
  on pull_request_reviews (pr_id, is_mentor);
create index if not exists pull_request_reviews_reviewer_idx
  on pull_request_reviews (reviewer_user_id, submitted_at desc);

alter table pull_request_reviews enable row level security;
drop policy if exists pull_request_reviews_read_all on pull_request_reviews;
create policy pull_request_reviews_read_all on pull_request_reviews for select using (true);

-- ========================================================================
-- github_installation_users — junction so multiple users can be linked to
-- the same install with different permission levels. Supports multi-admin
-- orgs and per-repo admins.
-- ========================================================================

create table if not exists github_installation_users (
  installation_id   bigint not null references github_installations(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  permission_level  text not null check (permission_level in ('org_admin', 'repo_admin', 'repo_maintain')),
  source            text not null check (source in ('install_creator', 'membership_check', 'manual_invite')),
  verified_at       timestamptz not null default now(),
  primary key (installation_id, user_id)
);

create index if not exists github_installation_users_user_idx
  on github_installation_users (user_id);

alter table github_installation_users enable row level security;
-- service-role only (no select policy → no public read)

-- ========================================================================
-- installation_user_repos — per-user repo scoping for non-org-admin users.
-- org_admin users skip this table; their scope is "everything in the install".
-- repo_admin / repo_maintain users list their specific repos here.
-- ========================================================================

create table if not exists installation_user_repos (
  installation_id   bigint not null references github_installations(id) on delete cascade,
  user_id           uuid not null references profiles(id) on delete cascade,
  repo_full_name    text not null,
  permission_level  text not null check (permission_level in ('admin', 'maintain')),
  verified_at       timestamptz not null default now(),
  primary key (installation_id, user_id, repo_full_name)
);

create index if not exists installation_user_repos_user_idx
  on installation_user_repos (user_id);

alter table installation_user_repos enable row level security;
-- service-role only

-- ========================================================================
-- org_communities — maintainer-curated links contributors can discover.
-- ========================================================================

create table if not exists org_communities (
  id                  bigserial primary key,
  installation_id     bigint not null references github_installations(id) on delete cascade,
  kind                text not null check (kind in ('discord', 'slack', 'forum', 'website', 'twitter', 'other')),
  url                 text not null,
  label               text,
  created_by_user_id  uuid references profiles(id) on delete set null,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (installation_id, kind)
);

create index if not exists org_communities_install_idx
  on org_communities (installation_id);

alter table org_communities enable row level security;
drop policy if exists org_communities_read_all on org_communities;
create policy org_communities_read_all on org_communities for select using (true);
