-- Issue #91: Recommendation quality feedback loop
-- Adds skip_reason to recommendations and mute preferences to profiles.

-- 1. Optional skip reason on recommendations (free text, never required).
alter table recommendations
  add column if not exists skip_reason text;

-- 2. Contributor mute preferences on profiles.
-- Arrays of repo full names / language strings. Default empty array.
alter table profiles
  add column if not exists muted_repos    text[] not null default '{}',
  add column if not exists muted_languages text[] not null default '{}';
