-- Public, unauthenticated report snapshots for Share Report (#719).
-- Row is readable by anyone holding the token; there is no listing policy,
-- so tokens must be unguessable (crypto.randomBytes, not Math.random).
create table if not exists report_snapshots (
  id              bigserial primary key,
  token           text not null unique,
  installation_id bigint not null references github_installations(id) on delete cascade,
  range           text not null,
  snapshot_data   jsonb not null,
  created_by      uuid not null references profiles(id),
  created_at      timestamptz not null default now(),
  expires_at      timestamptz not null
);

create index if not exists report_snapshots_token_idx on report_snapshots(token);
create index if not exists report_snapshots_installation_idx on report_snapshots(installation_id);

-- RLS is enabled with no policies at all: this table is service-role only.
-- service_role bypasses RLS regardless, and no client-side code queries
-- this table directly — the public /report/[token] page reads it via
-- getServiceSupabase(). Exposure is bounded by token guessability
-- (crypto.randomBytes) + the 30-day expiry check done in page.tsx.
alter table report_snapshots enable row level security;

-- PostgREST requires explicit table grants in addition to RLS (see 0021).
-- report_snapshots was created after 0021's blanket grant ran, so it
-- needs its own explicit grant for the service-role client used by
-- the public /report/[token] page.
grant all on report_snapshots to postgres, service_role;
grant usage, select on sequence report_snapshots_id_seq to postgres, service_role;