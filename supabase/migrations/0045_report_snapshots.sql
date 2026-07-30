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

alter table report_snapshots enable row level security;

-- Public read by token. This intentionally allows anon SELECT on any row --
-- exposure is bounded only by token guessability + the 30-day expiry check
-- done in the app layer (page.tsx), not by RLS.
drop policy if exists report_snapshots_read_by_token on report_snapshots;
-- remove entirely — service_role already bypasses RLS, and no client-side
-- code queries this table directly

-- No insert/update/delete policy -> service-role only.

-- PostgREST requires explicit table grants in addition to RLS (see 0021).
-- report_snapshots was created after 0021's blanket grant ran, so it
-- needs its own explicit grant for the service-role client used by
-- the public /report/[token] page.
grant all on report_snapshots to postgres, service_role;
grant usage, select on sequence report_snapshots_id_seq to postgres, service_role;