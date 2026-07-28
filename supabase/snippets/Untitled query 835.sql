INSERT INTO pull_requests (number, title, url, repo_full_name, state, github_updated_at, author_login, author_user_id, github_pr_id, github_created_at)
VALUES (
  9998,
  'Test: stale PR for banner (Quark UI)',
  'https://github.com/demo/quark-ui/pull/9998',
  'demo/quark-ui',
  'open',
  NOW() - INTERVAL '15 days',
  'testuser',
  NULL,
  9998,
  NOW() - INTERVAL '20 days'
);