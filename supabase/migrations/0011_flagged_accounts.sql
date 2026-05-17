create table if not exists flagged_accounts (
  id bigserial primary key,
  user_id uuid references profiles(id) on delete set null,
  reason text not null check (reason in ('daily_event_burst', 'hourly_merge_burst', 'review_pair_burst')),
  severity text not null default 'medium' check (severity in ('medium', 'high')),
  status text not null default 'open' check (status in ('open', 'resolved', 'dismissed')),
  dedupe_key text not null unique,
  evidence jsonb not null,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index if not exists flagged_accounts_status_created_idx
  on flagged_accounts(status, created_at desc);

create index if not exists flagged_accounts_user_created_idx
  on flagged_accounts(user_id, created_at desc);

alter table flagged_accounts enable row level security;
