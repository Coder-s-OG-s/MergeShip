INSERT INTO pull_requests (number, title, url, repo_full_name, state, github_updated_at, author_login, author_user_id, github_pr_id, github_created_at)
VALUES (
  9999,
  'Test: stale PR for banner',
  'https://github.com/demo/sample-repo/pull/9999',
  'demo/sample-repo',
  'open',
  NOW() - INTERVAL '15 days',
  'testuser',
  NULL,
  9999,
  NOW() - INTERVAL '20 days'
);