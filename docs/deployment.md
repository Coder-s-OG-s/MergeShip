# MergeShip deployment guide

Follow this start-to-finish to bring production from a fresh Vercel project to a working app. Roughly 2-3 hours of clicking through dashboards + copying secrets.

If you skip any step, the deployment will still build but the corresponding feature will degrade — the codebase is hardened to fail open on missing env vars.

## 1. Supabase

1. Create a new project at https://supabase.com/dashboard
2. Pick a region close to your Vercel deploy
3. Wait for provisioning to finish

Grab these from **Project settings → API**:
- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- `anon` public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `service_role` key → `SUPABASE_SERVICE_ROLE_KEY` (keep secret)

Grab this from **Project settings → Database → Connection string** → URI tab:
- Pooled connection (port 6543) → `DATABASE_URL`

### Run the schema

In **SQL Editor** paste the contents of `supabase/migrations/0001_initial_schema.sql` and run it. This creates all tables + the `xp_events` recompute trigger + RLS policies + `level_for_xp()` function.

### GitHub OAuth provider

**Authentication → Providers → GitHub** → enable, paste a GitHub OAuth App's client id and secret. You'll create that OAuth app in step 2 below.

The callback URL Supabase shows is `https://<project>.supabase.co/auth/v1/callback`. Use this when creating the GitHub OAuth App.

## 2. GitHub OAuth App (sign-in)

Create at https://github.com/settings/developers → **OAuth Apps** → New OAuth App
- Application name: `MergeShip`
- Homepage URL: `https://mergeship.dev`
- Authorization callback URL: the one Supabase showed above

Copy client id + generate client secret. Paste both into Supabase's GitHub provider settings.

## 3. GitHub App (install gate, webhooks)

Create at https://github.com/settings/apps/new

- App name: `MergeShip` (note the slug — set `GITHUB_APP_SLUG` to match)
- Homepage URL: `https://mergeship.dev`
- Webhook URL: `https://mergeship.dev/api/webhooks/github`
- Webhook secret: generate a long random string → `GITHUB_WEBHOOK_SECRET`

**Permissions** (Repository):
- Contents: Read
- Issues: Read & write
- Pull requests: Read
- Pull request review: Read
- Metadata: Read

**Subscribe to events**:
- Pull request
- Pull request review
- Issues
- Issue comment
- Installation
- Installation repositories

After creating:
- Copy App ID → `GITHUB_APP_ID`
- Copy Client ID → `GITHUB_APP_CLIENT_ID`
- Generate Client secret → `GITHUB_APP_CLIENT_SECRET`
- Generate Private key, paste the full PEM (including `-----BEGIN PRIVATE KEY-----` lines) into `GITHUB_APP_PRIVATE_KEY`. In Vercel env vars, paste the contents verbatim — line breaks are preserved.

## 4. Redis (cache + rate limit)

In Vercel dashboard → **Storage** → **Marketplace** → **Redis** (Official Redis for Vercel). Free tier: 30 MB storage, unlimited commands.

Once provisioned, click **Connect Project** → select your MergeShip project. Env vars auto-injected:
- `KV_REST_API_URL`
- `KV_REST_API_TOKEN`
- `KV_REST_API_READ_ONLY_TOKEN`

## 5. Inngest (background jobs)

Create app at https://app.inngest.com/sign-in → new app called `mergeship`.

From the app dashboard:
- Event key → `INNGEST_EVENT_KEY`
- Signing key → `INNGEST_SIGNING_KEY`

In Inngest's app settings, set the Serve URL to `https://mergeship.dev/api/inngest`.

## 6. Groq (LLM)

Get a key at https://console.groq.com/keys → `GROQ_API_KEY`. Free tier is plenty for our scale.

`GROQ_BUDGET_PER_DAY` defaults to 400000 tokens; tune later.

## 7. Vercel env vars

In Vercel dashboard → Settings → Environment Variables, add everything above to **Production**. The full list:

```
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY
SUPABASE_SERVICE_ROLE_KEY
DATABASE_URL

GITHUB_APP_ID
GITHUB_APP_CLIENT_ID
GITHUB_APP_CLIENT_SECRET
GITHUB_APP_PRIVATE_KEY
GITHUB_APP_SLUG
GITHUB_WEBHOOK_SECRET

KV_REST_API_URL          (auto)
KV_REST_API_TOKEN        (auto)

INNGEST_EVENT_KEY
INNGEST_SIGNING_KEY

GROQ_API_KEY
GROQ_BUDGET_PER_DAY=400000

NEXT_PUBLIC_APP_URL=https://mergeship.dev
```

Leave `MOCK_*` vars unset in production.

## 8. Seed cohorts (optional)

Cohorts are groupings used by leaderboards — e.g. participants in an OSS program (GSoC, LFX Mentorship, Outreachy, any of them), a class, a hackathon batch. Skip this if you don't have one yet; the global + per-language leaderboards work without any cohort rows.

Example, replace with whatever makes sense for your launch:

```sql
insert into cohorts (slug, name, starts_at, ends_at)
values ('spring-26', 'Spring 2026', '2026-03-01', '2026-06-30');
```

## 9. Merge the branch

Open the PR from `feat/backend-rebuild` → `main`, mark it ready for review, merge.

Vercel auto-deploys. mergeship.dev now serves the rebuild.

## 10. Smoke test on prod

1. Visit https://mergeship.dev → landing renders
2. Click "Get Started →" → GitHub OAuth flow
3. After OAuth, you should hit `/install` if you haven't installed the App
4. Install on your account → webhook fires → installation row created → unblocked
5. Land on `/onboarding`, complete a module
6. Land on `/dashboard`, see your XP/level
7. Fire a test webhook from the GitHub App's "Advanced" tab — verify it returns 200

## Things that fail open

If you forget any env var, the corresponding feature degrades gracefully:
- Missing Supabase → landing renders with "Sign-in coming soon"
- Missing Redis → cache misses on every request (slower, still works)
- Missing Groq → difficulty scoring uses label heuristic only
- Missing Inngest → server actions still work, background jobs don't
- Missing GitHub App → users can sign in but can't get past `/install`

Verify in the order above; if any step blocks, jump to the corresponding section.
