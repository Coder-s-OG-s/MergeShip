-- Issue #617: CRITICAL — profiles_read_all RLS policy exposes ALL profile fields
-- (muted_repos, timezone, URLs, bio, skills, weekly_digest, audit_completed, etc.)
-- to anonymous users via the PostgREST API.
--
-- The application already uses the service role (bypasses RLS) for all public
-- profile reads (leaderboards, search, public profiles, etc.), so this policy
-- is pure attack surface with no app benefit.
--
-- Fix: Restrict SELECT to the profile owner only.

drop policy if exists profiles_read_all on profiles;

create policy profiles_read_own on profiles
  for select
  using (auth.uid() = id);
