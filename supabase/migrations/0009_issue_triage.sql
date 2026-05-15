-- Maintainer-side fields on issues so we can power the triage view.
-- The contributor-side rec pipeline uses repo_full_name + number as the key
-- and only fills in (title, body, labels, difficulty, repo_health). Webhook
-- ingestion fills in the rest. All columns nullable so existing rows survive.

alter table issues
  add column if not exists github_issue_id    bigint,
  add column if not exists author_login       text,
  add column if not exists assignee_login     text,
  add column if not exists comments_count     int not null default 0,
  add column if not exists closed_at          timestamptz,
  add column if not exists github_created_at  timestamptz,
  add column if not exists github_updated_at  timestamptz,
  add column if not exists last_event_at      timestamptz;

-- Maintainer queue index: open issues per repo, newest activity first.
create index if not exists issues_repo_state_event_idx
  on issues (repo_full_name, state, last_event_at desc);

-- For triage filtering: issues with no assignee surface first.
create index if not exists issues_repo_unassigned_idx
  on issues (repo_full_name, state)
  where assignee_login is null;
