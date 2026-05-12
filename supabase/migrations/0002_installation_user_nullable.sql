-- Allow github_installations.user_id to be null so the install webhook can
-- record an install before the user has a profile row (race / first-time flow).
-- The /install page back-links these orphans on the next visit.

alter table github_installations
  alter column user_id drop not null;
