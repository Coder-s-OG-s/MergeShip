-- Stash the GitHub comment id we posted when flipping mentor_verified.
-- Lets us update the same comment if a higher-level mentor reviews later
-- instead of spamming the PR with a new comment.

alter table pull_requests
  add column if not exists mentor_comment_id bigint;
