# Dashboard GitHub Data Sync — Design Spec
**Date:** 2026-05-14  
**Status:** Approved

---

## Overview

Replace the dashboard's Mergeship-internal stat counters (Total Merges, Current Streak) and AI-suggestion feed (Active Issues) with real GitHub data, served fast via a sync-to-Supabase model. A single "Sync" button triggers all GitHub API calls at once and writes results to the DB; the dashboard always reads from Supabase + Redis cache, never from GitHub directly on page load.

---

## Goals

- Total Merges → all-time merged PR count from GitHub (REST Search API)
- Current Streak → consecutive calendar days with any GitHub contribution (GraphQL contributions calendar)
- Active Issues → claimed recommendations from `recommendations` table (query fix only, no GitHub API)
- My PRs → all GitHub PRs synced to DB, with client-side filter (Open / Closed / Merged), showing repo name, date opened, state badge, and CLAIMED tag if linked to a recommendation
- Remove org dropdown from dashboard header
- Add a Sync button with "Last synced X ago" label and 60s cooldown

---

## Out of Scope

- AI issue suggestions page (future feature — separate from this work)
- Per-section independent sync
- GitHub App installation token usage for stats (user OAuth token used instead)

---

## Database Schema

### New columns on `profiles`

```sql
ALTER TABLE profiles
  ADD COLUMN github_total_merges   integer,
  ADD COLUMN github_streak         integer,
  ADD COLUMN github_stats_synced_at timestamptz;
```

### New table `github_prs`

```sql
CREATE TABLE github_prs (
  id             text        PRIMARY KEY,  -- GitHub PR node ID
  user_id        uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title          text        NOT NULL,
  repo_full_name text        NOT NULL,
  state          text        NOT NULL CHECK (state IN ('open', 'closed', 'merged')),
  pr_number      integer     NOT NULL,
  pr_url         text        NOT NULL,
  opened_at      timestamptz NOT NULL
);

CREATE INDEX github_prs_user_state ON github_prs (user_id, state);
```

No JSON blobs. Typed columns enable simple indexed queries for the state filter.

---

## Sync Action

**File:** `src/app/actions/github-sync.ts`  
**Export:** `syncGitHubStats(): Promise<Result<SyncOutput>>`

### Flow

1. Get authenticated user from `sb.auth.getUser()`
2. Get `provider_token` from `sb.auth.getSession()` — if missing, return `err('no_token')`
3. Read `github_handle` from `profiles`
4. Fire 3 GitHub API calls **in parallel** via `Promise.all`:
   - **REST Search:** `GET /search/issues?q=is:pr+is:merged+author:{handle}&per_page=1` → `total_count` = total merges
   - **GraphQL:** `contributionsCollection { contributionCalendar { weeks { contributionDays } } }` → calculate consecutive-day streak ending today
   - **REST Search paginated:** `GET /search/issues?q=is:pr+author:{handle}&per_page=100` (up to 3 pages = 300 PRs) → all states
5. Determine PR state per item: if `pull_request.merged_at` is set → `merged`; else if `state === 'closed'` → `closed`; else → `open`
6. Write to Supabase atomically:
   - `profiles.update({ github_total_merges, github_streak, github_stats_synced_at: now() })`
   - `github_prs.upsert(allPrs, { onConflict: 'id' })`
   - Delete stale PRs for this user not in the new batch (handles closed/deleted PRs disappearing)
7. Invalidate Redis cache key `gh:dashboard:{userId}`
8. Return `ok({ merges, streak, prs })`

### Streak Calculation

From the GraphQL response, walk `contributionCalendar.weeks[].contributionDays[]` backwards from today. Count consecutive days where `contributionCount > 0`. Stop at the first zero-contribution day.

### Error Handling

- If `provider_token` is missing: return `err('no_token')` — UI shows "Connect GitHub" prompt
- If GitHub API rate-limited (429): return `err('rate_limited')` — UI shows "Rate limited, try later"
- If any individual call fails: abort entire sync, return `err('github_api_error')` — no partial writes

---

## Dashboard Read Path

```
dashboard/page.tsx (server component)
  ↓
Check Redis cache key: gh:dashboard:{userId}  (TTL 5 min)
  ↓ cache miss
Query Supabase:
  - profiles: github_total_merges, github_streak, github_stats_synced_at
  - github_prs: all rows for user_id (pass all to client)
  - recommendations: where user_id = me AND status = 'claimed' (Active Issues)
  ↓
Set Redis cache (5 min TTL)
  ↓
If github_stats_synced_at IS NULL → call syncGitHubStats() silently (first login)
  ↓
Render page
```

---

## Component Changes

### Header

- **Remove:** `<select>` org dropdown and all `orgList` / `insts` query logic
- **Add:** `<SyncButton>` client component
  - Shows "SYNC" label + last synced timestamp ("Last synced 3m ago")
  - On click: calls `syncGitHubStats()` server action, refreshes page via `router.refresh()`
  - Disabled for 60s after a sync (local state timer)
  - Shows inline spinner while syncing

### Stats Row

- **Total Merges:** reads `profile.github_total_merges` (was `xp_events` count)
- **Current Streak:** reads `profile.github_streak` (was `xp_events` streak count)
- **Mentor Points:** unchanged
- **Level Progress:** unchanged

Both stats show `–` if `github_stats_synced_at` is null (not yet synced).

### Active Issues Section

- Query change only: `recommendations` where `status = 'claimed'` (was AI-suggested pending recs)
- Shows up to 2 claimed issues
- Empty state: "No active issues. Browse recommendations to claim one."
- "BROWSE MORE" link → `/issues` (future page)

### My PRs Section (`GitHubPRsPanel` — new client component)

- Receives full `prs` array as prop from server (all states)
- State filter dropdown: Open / Closed / Merged — filters local array, no API call
- Each card shows:
  - PR title
  - `repo_full_name` (e.g. `vercel/next.js`)
  - PR number + date opened (e.g. `#4521 · May 2, 2026`)
  - State badge: green MERGED / yellow OPEN / gray CLOSED
  - "CLAIMED" tag if `pr_url` matches any row in the passed `claimedUrls` set
- "VIEW ALL" link → GitHub profile PRs page
- Empty state per filter: "No open PRs." / "No closed PRs." / "No merged PRs."

---

## Caching Strategy

| Layer | Key | TTL | Invalidated by |
|---|---|---|---|
| Redis | `gh:dashboard:{userId}` | 5 min | Sync action completion |
| Supabase | — | permanent | Sync upsert |

Dashboard reads Redis first. On sync, Redis key is deleted; next page load repopulates it from Supabase.

---

## Files Touched

| File | Change |
|---|---|
| `src/app/(app)/dashboard/page.tsx` | Rewrite data fetching; remove org dropdown; pass new props |
| `src/app/(app)/dashboard/rec-cards.tsx` | No change |
| `src/app/(app)/dashboard/sync-button.tsx` | New client component |
| `src/app/(app)/dashboard/github-prs-panel.tsx` | New client component |
| `src/app/actions/github-sync.ts` | New server action |
| `src/lib/github/app.ts` | No change |
| `src/lib/github/api.ts` | No change |
| Supabase migration | Add columns to profiles + create github_prs table |
