-- Event sourcing + CQRS infrastructure
-- Provides idempotent command processing with full audit trail.

create table if not exists events (
  id              uuid primary key default gen_random_uuid(),
  aggregate_type  text not null,
  aggregate_id    text not null,
  event_type      text not null,
  version         int not null,
  payload         jsonb not null,
  metadata        jsonb,
  idempotency_key text unique,
  occurred_at     timestamptz not null default now(),
  processed_at    timestamptz
);

create index if not exists idx_events_aggregate
  on events (aggregate_type, aggregate_id);
create index if not exists idx_events_occurred_at
  on events (occurred_at desc);
create index if not exists idx_events_idempotency_key
  on events (idempotency_key);

-- idempotency_keys table for lightweight lookups without scanning events
create table if not exists idempotency_keys (
  key         text primary key,
  response    jsonb not null,
  created_at  timestamptz not null default now()
);

-- Auto-cleanup old idempotency keys after 7 days
create index if not exists idx_idempotency_keys_created_at
  on idempotency_keys (created_at);
