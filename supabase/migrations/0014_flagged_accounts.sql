-- Suspicious XP / review pattern flags for maintainer review.
-- Detection rows are written by scheduled service-role jobs and read by
-- authenticated maintainers through server actions.

create table if not exists flagged_accounts (
  id           bigserial primary key,
  user_id      uuid references profiles(id) on delete cascade,
  reason       text not null check (
    reason in (
      'daily_xp_event_spike',
      'rapid_merge_spike',
      'reviewer_approval_concentration'
    )
  ),
  severity     text not null default 'medium' check (severity in ('medium', 'high')),
  status       text not null default 'open' check (status in ('open', 'reviewed', 'dismissed')),
  evidence     jsonb not null default '{}'::jsonb,
  detected_at  timestamptz not null default now(),
  resolved_at  timestamptz,
  unique (user_id, reason, status)
);

create index if not exists flagged_accounts_status_detected_idx
  on flagged_accounts (status, detected_at desc);
create index if not exists flagged_accounts_user_idx
  on flagged_accounts (user_id);

alter table flagged_accounts enable row level security;
-- service-role only: no public policies by design.
