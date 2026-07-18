-- Issue #328: Maintainer repo picker.
-- Adds a "managed" flag to installation_repositories so a maintainer can pick
-- which installed repos MergeShip actively manages, separate from "what GitHub
-- says is installed". Default true keeps every existing install unaffected.

set search_path to public;

alter table installation_repositories
  add column if not exists managed boolean not null default true;
