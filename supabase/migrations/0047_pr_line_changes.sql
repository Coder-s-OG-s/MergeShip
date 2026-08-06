-- Store GitHub-reported line change counts on pull_requests so the
-- contributor dashboard can show real +additions/-deletions instead of
-- generated placeholders (#870). Nullable: older rows and search/list
-- syncs that do not return these fields stay unavailable until a
-- webhook or full PR fetch fills them in.
alter table pull_requests
  add column if not exists additions integer,
  add column if not exists deletions integer;
