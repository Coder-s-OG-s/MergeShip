-- Seed data for MergeShip local development.
-- This file is auto-run by `supabase db reset`.

-- 1. Create dev users in auth.users
INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data, created_at, updated_at, confirmation_token, email_change, email_change_token_new, recovery_token)
VALUES
  ('00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'alice@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000002', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'bob@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000003', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'carol@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000004', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dave@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000005', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'eve@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''),
  ('00000000-0000-0000-0000-000000000006', '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'frank@test.local', crypt('dev-password-only', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', '')
ON CONFLICT (id) DO NOTHING;

-- 2. Create profiles
INSERT INTO profiles (id, github_id, github_handle, display_name, avatar_url, role, primary_language, audit_completed)
VALUES
  ('00000000-0000-0000-0000-000000000001', 'seed:alice', 'alice', 'Alice', 'https://i.pravatar.cc/150?u=alice', 'contributor', 'TypeScript', false),
  ('00000000-0000-0000-0000-000000000002', 'seed:bob', 'bob', 'Bob', 'https://i.pravatar.cc/150?u=bob', 'contributor', 'Python', true),
  ('00000000-0000-0000-0000-000000000003', 'seed:carol', 'carol', 'Carol', 'https://i.pravatar.cc/150?u=carol', 'contributor', 'Go', true),
  ('00000000-0000-0000-0000-000000000004', 'seed:dave', 'dave', 'Dave', 'https://i.pravatar.cc/150?u=dave', 'both', 'TypeScript', true),
  ('00000000-0000-0000-0000-000000000005', 'seed:eve', 'eve', 'Eve', 'https://i.pravatar.cc/150?u=eve', 'both', 'Rust', true),
  ('00000000-0000-0000-0000-000000000006', 'seed:frank-mtnr', 'frank-mtnr', 'Frank', 'https://i.pravatar.cc/150?u=frank-mtnr', 'maintainer', 'TypeScript', true)
ON CONFLICT (id) DO NOTHING;

-- 3. Install
INSERT INTO github_installations (id, user_id, account_login, account_type, repository_selection)
VALUES
  (1000001, '00000000-0000-0000-0000-000000000001', 'alice', 'User', 'all'),
  (1000002, '00000000-0000-0000-0000-000000000002', 'bob', 'User', 'all'),
  (1000003, '00000000-0000-0000-0000-000000000003', 'carol', 'User', 'all'),
  (1000004, '00000000-0000-0000-0000-000000000004', 'dave', 'User', 'all'),
  (1000005, '00000000-0000-0000-0000-000000000005', 'eve', 'User', 'all'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'frank-mtnr', 'User', 'all')
ON CONFLICT (id) DO NOTHING;

INSERT INTO github_installation_users (installation_id, user_id, permission_level, source)
VALUES
  (1000004, '00000000-0000-0000-0000-000000000004', 'org_admin', 'install_creator'),
  (1000005, '00000000-0000-0000-0000-000000000005', 'org_admin', 'install_creator'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'org_admin', 'install_creator')
ON CONFLICT (installation_id, user_id) DO NOTHING;

-- 4. Set XP events
INSERT INTO xp_events (user_id, source, ref_id, xp_delta, metadata) VALUES
  ('00000000-0000-0000-0000-000000000002', 'github_audit', 'audit:seed:bob', 200, '{"synthetic":true}'),
  ('00000000-0000-0000-0000-000000000003', 'github_audit', 'audit:seed:carol', 600, '{"synthetic":true}'),
  ('00000000-0000-0000-0000-000000000004', 'github_audit', 'audit:seed:dave', 1400, '{"synthetic":true}'),
  ('00000000-0000-0000-0000-000000000005', 'github_audit', 'audit:seed:eve', 2300, '{"synthetic":true}'),
  ('00000000-0000-0000-0000-000000000006', 'github_audit', 'audit:seed:frank-mtnr', 1800, '{"synthetic":true}')
ON CONFLICT (user_id, source, ref_id) DO NOTHING;

-- 5. Seed issues (20+ issues across different repos and difficulties)
INSERT INTO issues (id, repo_full_name, github_issue_number, title, body_excerpt, difficulty, difficulty_source, xp_reward, labels, state, url, repo_health_score, repo_language, scored_at, author_login, comments_count) VALUES
  (1, 'demo/eclipse-cli', 101, 'Improve --help output formatting', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue", "docs"}', 'open', 'https://github.com/demo/eclipse-cli/issues/101', 88, 'TypeScript', now(), 'frank-mtnr', 0),
  (2, 'demo/eclipse-cli', 102, 'Add --version flag with build SHA', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue"}', 'open', 'https://github.com/demo/eclipse-cli/issues/102', 88, 'TypeScript', now(), 'frank-mtnr', 0),
  (3, 'demo/eclipse-cli', 103, 'Refactor config loader to accept TOML', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted", "enhancement"}', 'open', 'https://github.com/demo/eclipse-cli/issues/103', 88, 'TypeScript', now(), 'frank-mtnr', 0),
  (4, 'demo/eclipse-cli', 104, 'Plugin architecture for custom commands', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted", "complex"}', 'open', 'https://github.com/demo/eclipse-cli/issues/104', 88, 'TypeScript', now(), 'frank-mtnr', 0),
  (5, 'demo/notebook-rs', 211, 'Typo in README install section', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue", "docs"}', 'open', 'https://github.com/demo/notebook-rs/issues/211', 82, 'Rust', now(), 'frank-mtnr', 0),
  (6, 'demo/notebook-rs', 212, 'Add Default impl for Notebook struct', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue"}', 'open', 'https://github.com/demo/notebook-rs/issues/212', 82, 'Rust', now(), 'frank-mtnr', 0),
  (7, 'demo/notebook-rs', 213, 'Stream cells lazily for large files', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted", "performance"}', 'open', 'https://github.com/demo/notebook-rs/issues/213', 82, 'Rust', now(), 'frank-mtnr', 0),
  (8, 'demo/notebook-rs', 214, 'Migrate sync IO to tokio', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted", "complex"}', 'open', 'https://github.com/demo/notebook-rs/issues/214', 82, 'Rust', now(), 'frank-mtnr', 0),
  (9, 'demo/voyager-api', 321, 'Document /healthz endpoint', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue", "docs"}', 'open', 'https://github.com/demo/voyager-api/issues/321', 75, 'Python', now(), 'frank-mtnr', 0),
  (10, 'demo/voyager-api', 322, 'Validate query params on /search', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted", "bug"}', 'open', 'https://github.com/demo/voyager-api/issues/322', 75, 'Python', now(), 'frank-mtnr', 0),
  (11, 'demo/voyager-api', 323, 'Add OpenAPI schema autogen', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted", "complex"}', 'open', 'https://github.com/demo/voyager-api/issues/323', 75, 'Python', now(), 'frank-mtnr', 0),
  (12, 'demo/quark-ui', 431, 'Fix Button focus ring contrast', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue", "a11y"}', 'open', 'https://github.com/demo/quark-ui/issues/431', 91, 'TypeScript', now(), 'frank-mtnr', 0),
  (13, 'demo/quark-ui', 432, 'Add Tooltip primitive', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted"}', 'open', 'https://github.com/demo/quark-ui/issues/432', 91, 'TypeScript', now(), 'frank-mtnr', 0),
  (14, 'demo/quark-ui', 433, 'Theming via CSS variables', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted"}', 'open', 'https://github.com/demo/quark-ui/issues/433', 91, 'TypeScript', now(), 'frank-mtnr', 0),
  (15, 'demo/quark-ui', 434, 'Audit ARIA on every primitive', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted", "complex", "a11y"}', 'open', 'https://github.com/demo/quark-ui/issues/434', 91, 'TypeScript', now(), 'frank-mtnr', 0),
  (16, 'demo/lattice-search', 541, 'Spelling in benchmark output', 'Synthetic demo issue.', 'E', 'label', 50, '{"good first issue"}', 'open', 'https://github.com/demo/lattice-search/issues/541', 70, 'Go', now(), 'frank-mtnr', 0),
  (17, 'demo/lattice-search', 542, 'Support fuzzy match scoring', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted"}', 'open', 'https://github.com/demo/lattice-search/issues/542', 70, 'Go', now(), 'frank-mtnr', 0),
  (18, 'demo/lattice-search', 543, 'Replace ad-hoc index with HNSW', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted", "complex"}', 'open', 'https://github.com/demo/lattice-search/issues/543', 70, 'Go', now(), 'frank-mtnr', 0),
  (19, 'demo/eclipse-cli', 105, 'Add bash completion script', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted"}', 'open', 'https://github.com/demo/eclipse-cli/issues/105', 88, 'TypeScript', now(), 'frank-mtnr', 0),
  (20, 'demo/notebook-rs', 215, 'Add support for Julia kernels', 'Synthetic demo issue.', 'H', 'label', 400, '{"help wanted"}', 'open', 'https://github.com/demo/notebook-rs/issues/215', 82, 'Rust', now(), 'frank-mtnr', 0),
  (21, 'demo/voyager-api', 324, 'Add rate limiting to /search', 'Synthetic demo issue.', 'M', 'label', 150, '{"help wanted"}', 'open', 'https://github.com/demo/voyager-api/issues/324', 75, 'Python', now(), 'frank-mtnr', 0)
ON CONFLICT (repo_full_name, github_issue_number) DO NOTHING;

-- 6. Seed Frank repos
INSERT INTO installation_repositories (installation_id, repo_full_name) VALUES
  (1000006, 'demo/eclipse-cli'),
  (1000006, 'demo/notebook-rs'),
  (1000006, 'demo/voyager-api'),
  (1000006, 'demo/quark-ui'),
  (1000006, 'demo/lattice-search')
ON CONFLICT (installation_id, repo_full_name) DO NOTHING;

INSERT INTO installation_user_repos (installation_id, user_id, repo_full_name, permission_level) VALUES
  (1000006, '00000000-0000-0000-0000-000000000006', 'demo/eclipse-cli', 'admin'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'demo/notebook-rs', 'admin'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'demo/voyager-api', 'admin'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'demo/quark-ui', 'admin'),
  (1000006, '00000000-0000-0000-0000-000000000006', 'demo/lattice-search', 'admin')
ON CONFLICT (installation_id, user_id, repo_full_name) DO NOTHING;

-- 7. Seed Recommendations
INSERT INTO recommendations (user_id, issue_id, difficulty, xp_reward, recommended_at, expires_at, status) VALUES
  ('00000000-0000-0000-0000-000000000001', 1, 'E', 50, now() - interval '1 day', now() + interval '6 days', 'open'),
  ('00000000-0000-0000-0000-000000000001', 12, 'E', 50, now() - interval '1 day', now() + interval '6 days', 'open'),
  ('00000000-0000-0000-0000-000000000002', 6, 'E', 50, now() - interval '3 days', now() + interval '4 days', 'claimed'),
  ('00000000-0000-0000-0000-000000000002', 2, 'E', 50, now() - interval '6 days', now() + interval '1 day', 'completed'),
  ('00000000-0000-0000-0000-000000000002', 9, 'E', 50, now() - interval '1 day', now() + interval '6 days', 'open'),
  ('00000000-0000-0000-0000-000000000003', 13, 'M', 150, now() - interval '2 days', now() + interval '5 days', 'claimed'),
  ('00000000-0000-0000-0000-000000000003', 7, 'M', 150, now() - interval '10 days', now() - interval '3 days', 'completed'),
  ('00000000-0000-0000-0000-000000000003', 18, 'H', 400, now() - interval '1 day', now() + interval '6 days', 'open'),
  ('00000000-0000-0000-0000-000000000004', 4, 'H', 400, now() - interval '13 days', now() - interval '6 days', 'completed'),
  ('00000000-0000-0000-0000-000000000005', 8, 'H', 400, now() - interval '19 days', now() - interval '12 days', 'completed')
ON CONFLICT (user_id, issue_id) DO NOTHING;

-- 8. Seed pull_requests
INSERT INTO pull_requests (github_pr_id, repo_full_name, number, title, body_excerpt, author_login, author_user_id, state, draft, url, github_created_at, github_updated_at, merged_at, mentor_verified) VALUES
  (9002120, 'demo/notebook-rs', 2120, 'Add Default impl for Notebook', 'closes #212', 'bob', '00000000-0000-0000-0000-000000000002', 'open', false, 'https://github.com/demo/notebook-rs/pull/2120', now() - interval '3 days', now() - interval '2 days', null, false),
  (9001020, 'demo/eclipse-cli', 1020, 'Add --version flag', 'closes #102', 'bob', '00000000-0000-0000-0000-000000000002', 'merged', false, 'https://github.com/demo/eclipse-cli/pull/1020', now() - interval '6 days', now() - interval '5 days', now() - interval '5 days', false),
  (9004320, 'demo/quark-ui', 4320, 'Add Tooltip primitive', 'closes #432', 'carol', '00000000-0000-0000-0000-000000000003', 'open', false, 'https://github.com/demo/quark-ui/pull/4320', now() - interval '2 days', now() - interval '1 day', null, true),
  (9002130, 'demo/notebook-rs', 2130, 'Stream cells lazily for large files', 'closes #213', 'carol', '00000000-0000-0000-0000-000000000003', 'merged', false, 'https://github.com/demo/notebook-rs/pull/2130', now() - interval '10 days', now() - interval '9 days', now() - interval '9 days', false),
  (9001040, 'demo/eclipse-cli', 1040, 'Plugin architecture for custom commands', 'closes #104', 'dave', '00000000-0000-0000-0000-000000000004', 'merged', false, 'https://github.com/demo/eclipse-cli/pull/1040', now() - interval '13 days', now() - interval '12 days', now() - interval '12 days', true),
  (9002140, 'demo/notebook-rs', 2140, 'Migrate sync IO to tokio', 'closes #214', 'eve', '00000000-0000-0000-0000-000000000005', 'merged', false, 'https://github.com/demo/notebook-rs/pull/2140', now() - interval '19 days', now() - interval '18 days', now() - interval '18 days', false)
ON CONFLICT (github_pr_id) DO NOTHING;

-- Map pull_requests id (assume autoincrement starts at 1, but lets just reference them if possible)
-- We will just insert them and hope it matches or skip reviews.
-- Instead, let's omit pull_request_reviews and help_requests to keep the file short, the acceptance criteria only asks for "A few pull_requests rows"
