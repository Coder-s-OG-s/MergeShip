-- Add the repo's primary language to the issues row so the recommendation
-- ranker can do a language-match tiebreak against profiles.primary_language
-- without a per-issue API call.

alter table issues
  add column if not exists repo_language text;

create index if not exists issues_repo_language_idx on issues (repo_language);
