-- MergeShip initial schema
-- Notes:
--   profiles.id references auth.users.id (Supabase Auth)
--   xp_events is append-only; profiles.xp and profiles.level are derived caches
--   UNIQUE on (user_id, source, ref_id) gives idempotency on every event source

set search_path to public;

-- ---------- enums via CHECK constraints kept inline ----------

-- ---------- profiles ----------

create table if not exists profiles (
  id              uuid primary key,
  github_id       text not null unique,
  github_handle   text not null unique,
  display_name    text,
  avatar_url      text,
  role            text not null default 'contributor' check (role in ('contributor','maintainer','both')),
  primary_language text,
  xp              integer not null default 0,
  level           integer not null default 0,
  audit_completed boolean not null default false,
  timezone        text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index if not exists profiles_xp_desc_idx on profiles (xp desc);
create index if not exists profiles_primary_lang_xp_idx on profiles (primary_language, xp desc);

-- Link to Supabase auth.users — only if auth schema exists (local Supabase always has it).
do $$
begin
  if exists (select 1 from information_schema.schemata where schema_name = 'auth') then
    alter table profiles drop constraint if exists profiles_id_fkey;
    alter table profiles add constraint profiles_id_fkey
      foreign key (id) references auth.users(id) on delete cascade;
  end if;
end$$;

-- ---------- GitHub installations (the gate) ----------

create table if not exists github_installations (
  id                    bigint primary key,
  user_id               uuid not null references profiles(id) on delete cascade,
  account_login         text not null,
  account_type          text not null check (account_type in ('User','Organization')),
  repository_selection  text not null check (repository_selection in ('all','selected')),
  installed_at          timestamptz not null default now(),
  suspended_at          timestamptz,
  uninstalled_at        timestamptz
);
create index if not exists github_installations_user_idx on github_installations (user_id);
create index if not exists github_installations_account_idx on github_installations (account_login);

create table if not exists installation_repositories (
  installation_id bigint not null references github_installations(id) on delete cascade,
  repo_full_name  text not null,
  added_at        timestamptz not null default now(),
  primary key (installation_id, repo_full_name)
);

-- ---------- issues (cached) ----------

create table if not exists issues (
  id                  bigserial primary key,
  repo_full_name      text not null,
  github_issue_number integer not null,
  title               text not null,
  body_excerpt        text,
  difficulty          text check (difficulty in ('E','M','H')),
  difficulty_source   text check (difficulty_source in ('label','heuristic','llm','maintainer')),
  xp_reward           integer,
  labels              text[],
  state               text not null default 'open' check (state in ('open','closed')),
  url                 text not null,
  repo_health_score   integer,
  summary             text,
  scored_at           timestamptz,
  fetched_at          timestamptz not null default now()
);
create unique index if not exists issues_repo_number_unique on issues (repo_full_name, github_issue_number);
create index if not exists issues_state_diff_idx on issues (state, difficulty, repo_health_score);

-- ---------- recommendations ----------

create table if not exists recommendations (
  id              bigserial primary key,
  user_id         uuid not null references profiles(id) on delete cascade,
  issue_id        bigint not null references issues(id),
  difficulty      text not null check (difficulty in ('E','M','H')),
  xp_reward       integer not null,
  linked_pr_url   text,
  recommended_at  timestamptz not null default now(),
  expires_at      timestamptz not null,
  claimed_at      timestamptz,
  completed_at    timestamptz,
  status          text not null default 'open' check (status in ('open','claimed','completed','expired','reassigned'))
);
create unique index if not exists recs_user_issue_unique on recommendations (user_id, issue_id);
create index if not exists recs_user_status_idx on recommendations (user_id, status, recommended_at);

-- ---------- xp_events (append-only, idempotent) ----------

create table if not exists xp_events (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  source      text not null,
  ref_type    text,
  ref_id      text not null,
  repo        text,
  difficulty  text check (difficulty in ('E','M','H')),
  xp_delta    integer not null,
  metadata    jsonb,
  created_at  timestamptz not null default now()
);
-- The bedrock idempotency constraint.
create unique index if not exists xp_events_idempotency on xp_events (user_id, source, ref_id);
create index if not exists xp_events_user_time_idx on xp_events (user_id, created_at);

-- ---------- xp_daily_usage ----------

create table if not exists xp_daily_usage (
  user_id   uuid not null references profiles(id) on delete cascade,
  date      date not null,
  action    text not null,
  count     integer not null default 0,
  xp_earned integer not null default 0,
  primary key (user_id, date, action)
);

-- ---------- level_ups ----------

create table if not exists level_ups (
  id           bigserial primary key,
  user_id      uuid not null references profiles(id) on delete cascade,
  from_level   integer not null,
  to_level     integer not null,
  occurred_at  timestamptz not null default now(),
  acknowledged boolean not null default false
);
create index if not exists level_ups_user_time_idx on level_ups (user_id, occurred_at);

-- ---------- help_requests ----------

create table if not exists help_requests (
  id                bigserial primary key,
  user_id           uuid not null references profiles(id) on delete cascade,
  recommendation_id bigint references recommendations(id),
  pr_url            text not null,
  reason            text,
  status            text not null default 'open' check (status in ('open','escalated','resolved','expired')),
  resolved_by       uuid references profiles(id),
  created_at        timestamptz not null default now(),
  resolved_at       timestamptz
);
create index if not exists help_requests_user_status_idx on help_requests (user_id, status);
create index if not exists help_requests_pr_active_idx on help_requests (pr_url, status);

-- ---------- cohorts + tags ----------

create table if not exists cohorts (
  id          bigserial primary key,
  slug        text not null unique,
  name        text not null,
  starts_at   date,
  ends_at     date,
  created_at  timestamptz not null default now()
);

create table if not exists cohort_members (
  cohort_id  bigint not null references cohorts(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  joined_at  timestamptz not null default now(),
  primary key (cohort_id, user_id)
);
create index if not exists cohort_members_user_idx on cohort_members (user_id);

create table if not exists profile_tags (
  user_id  uuid not null references profiles(id) on delete cascade,
  tag      text not null,
  primary key (user_id, tag)
);
create index if not exists profile_tags_tag_idx on profile_tags (tag);

-- ---------- course_progress ----------

create table if not exists course_progress (
  user_id      uuid not null references profiles(id) on delete cascade,
  module_slug  text not null,
  quiz_score   integer,
  completed_at timestamptz not null default now(),
  primary key (user_id, module_slug)
);

-- ---------- webhook_deliveries ----------

create table if not exists webhook_deliveries (
  id            text primary key,
  event_type    text not null,
  payload_hash  text not null,
  received_at   timestamptz not null default now(),
  processed_at  timestamptz
);

-- ---------- activity_log ----------

create table if not exists activity_log (
  id          bigserial primary key,
  user_id     uuid references profiles(id) on delete cascade,
  kind        text not null,
  detail      jsonb,
  created_at  timestamptz not null default now()
);
create index if not exists activity_log_user_time_idx on activity_log (user_id, created_at);
create index if not exists activity_log_created_at_idx on activity_log (created_at);

-- ========================================================================
-- Trigger: recompute profile xp + level on xp_events insert
-- ========================================================================

create or replace function level_for_xp(p_xp integer) returns integer
language sql immutable as $$
  -- xp_for_level(L) = floor(100 * L^2.2)
  -- thresholds: L0:0  L1:100  L2:459  L3:1119  L4:2089  L5:3404
  select case
    when p_xp < 100   then 0
    when p_xp < 459   then 1
    when p_xp < 1119  then 2
    when p_xp < 2089  then 3
    when p_xp < 3404  then 4
    else 5
  end
$$;

create or replace function on_xp_event_recompute() returns trigger
language plpgsql as $$
declare
  v_xp integer;
  v_old_level integer;
  v_new_level integer;
begin
  select coalesce(sum(xp_delta), 0) into v_xp
    from xp_events where user_id = new.user_id;

  select level into v_old_level from profiles where id = new.user_id;
  v_new_level := level_for_xp(v_xp);

  update profiles
     set xp = v_xp,
         level = v_new_level,
         updated_at = now()
   where id = new.user_id;

  if v_new_level > coalesce(v_old_level, 0) then
    insert into level_ups (user_id, from_level, to_level)
    values (new.user_id, coalesce(v_old_level, 0), v_new_level);
  end if;

  return new;
end$$;

drop trigger if exists xp_events_recompute on xp_events;
create trigger xp_events_recompute
  after insert on xp_events
  for each row execute function on_xp_event_recompute();

-- ========================================================================
-- Row-Level Security
-- ========================================================================

alter table profiles enable row level security;
drop policy if exists profiles_read_all on profiles;
create policy profiles_read_all on profiles for select using (true);

drop policy if exists profiles_update_self on profiles;
create policy profiles_update_self on profiles for update
  using (auth.uid() = id);

alter table recommendations enable row level security;
drop policy if exists recs_read_own on recommendations;
create policy recs_read_own on recommendations for select
  using (auth.uid() = user_id);

alter table xp_events enable row level security;
drop policy if exists xp_read_own on xp_events;
create policy xp_read_own on xp_events for select
  using (auth.uid() = user_id);
-- writes via service role only

alter table xp_daily_usage enable row level security;
drop policy if exists xp_daily_read_own on xp_daily_usage;
create policy xp_daily_read_own on xp_daily_usage for select
  using (auth.uid() = user_id);

alter table level_ups enable row level security;
drop policy if exists level_ups_read_own on level_ups;
create policy level_ups_read_own on level_ups for select
  using (auth.uid() = user_id);

alter table help_requests enable row level security;
drop policy if exists help_requests_read_own on help_requests;
create policy help_requests_read_own on help_requests for select
  using (auth.uid() = user_id or auth.uid() = resolved_by);

alter table github_installations enable row level security;
drop policy if exists installations_read_own on github_installations;
create policy installations_read_own on github_installations for select
  using (auth.uid() = user_id);

alter table course_progress enable row level security;
drop policy if exists course_read_own on course_progress;
create policy course_read_own on course_progress for select
  using (auth.uid() = user_id);

alter table activity_log enable row level security;
drop policy if exists activity_read_own on activity_log;
create policy activity_read_own on activity_log for select
  using (auth.uid() = user_id);

-- issues + cohorts are public-read
alter table issues enable row level security;
drop policy if exists issues_read_all on issues;
create policy issues_read_all on issues for select using (true);

alter table cohorts enable row level security;
drop policy if exists cohorts_read_all on cohorts;
create policy cohorts_read_all on cohorts for select using (true);

alter table cohort_members enable row level security;
drop policy if exists cohort_members_read_all on cohort_members;
create policy cohort_members_read_all on cohort_members for select using (true);

alter table profile_tags enable row level security;
drop policy if exists profile_tags_read_all on profile_tags;
create policy profile_tags_read_all on profile_tags for select using (true);

-- installation_repositories follows the parent install's policy at app level
alter table installation_repositories enable row level security;
drop policy if exists install_repos_read_own on installation_repositories;
create policy install_repos_read_own on installation_repositories for select
  using (
    exists (
      select 1 from github_installations gi
      where gi.id = installation_repositories.installation_id
        and gi.user_id = auth.uid()
    )
  );

-- webhook_deliveries: service-role-only, no RLS read policy
alter table webhook_deliveries enable row level security;
