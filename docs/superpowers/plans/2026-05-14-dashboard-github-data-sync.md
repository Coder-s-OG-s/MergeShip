# Dashboard GitHub Data Sync Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded/internal Mergeship stats on the dashboard with real GitHub data (merged PR count, contribution streak, all PRs), served from a Supabase cache populated by a user-triggered sync action.

**Architecture:** A single `syncGitHubStats()` server action fires 3 GitHub API calls in parallel (REST Search for merges + all PRs, GraphQL for streak), writes results to Supabase, and invalidates a Redis cache key. The dashboard page always reads from Supabase/Redis — never from GitHub directly on page load. My PRs is a client component with a local filter (no API call on filter change).

**Tech Stack:** Next.js 14 App Router, Supabase (Postgres + SSR client), Upstash Redis, Octokit REST (`@octokit/rest`), native `fetch` for GitHub GraphQL, Vitest, Tailwind CSS.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `supabase/migrations/0005_github_stats.sql` | Create | Add 3 columns to profiles + create github_prs table |
| `src/app/actions/github-sync.ts` | Create | Server action: fetch GitHub data, write to Supabase, bust cache |
| `src/app/actions/github-sync.test.ts` | Create | Unit tests for pure helpers (streak calc, PR state parsing) |
| `src/app/(app)/dashboard/sync-button.tsx` | Create | Client component: Sync button with cooldown + last-synced label |
| `src/app/(app)/dashboard/github-prs-panel.tsx` | Create | Client component: My PRs with Open/Closed/Merged filter |
| `src/app/(app)/dashboard/page.tsx` | Modify | Rewire queries; remove org dropdown; auto-sync on first load |

---

## Task 1: Database Migration

**Files:**
- Create: `supabase/migrations/0005_github_stats.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/0005_github_stats.sql
-- Add GitHub-synced stat columns to profiles and create github_prs cache table.

set search_path to public;

alter table profiles
  add column if not exists github_total_merges   integer,
  add column if not exists github_streak         integer,
  add column if not exists github_stats_synced_at timestamptz;

create table if not exists github_prs (
  id             text        primary key,
  user_id        uuid        not null references profiles(id) on delete cascade,
  title          text        not null,
  repo_full_name text        not null,
  state          text        not null check (state in ('open', 'closed', 'merged')),
  pr_number      integer     not null,
  pr_url         text        not null,
  opened_at      timestamptz not null
);

create index if not exists github_prs_user_state on github_prs (user_id, state);
```

- [ ] **Step 2: Apply the migration**

```bash
npx supabase db push
```

Expected: migration runs without error. If using local Supabase dev: `npx supabase db reset` or run the SQL directly in the Supabase Studio SQL editor.

- [ ] **Step 3: Commit**

```bash
git add supabase/migrations/0005_github_stats.sql
git commit -m "feat: add github_stats columns to profiles and github_prs table"
```

---

## Task 2: GitHub Sync Server Action

**Files:**
- Create: `src/app/actions/github-sync.ts`
- Create: `src/app/actions/github-sync.test.ts`

### Step 2a — Write the failing tests first

- [ ] **Step 1: Write tests for the two pure helper functions**

`src/app/actions/github-sync.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { calculateStreak, parsePRState } from './github-sync';

describe('calculateStreak', () => {
  const day = (date: string, count: number) => ({ date, contributionCount: count });

  it('returns 0 when no contributions', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('counts consecutive days ending today', () => {
    const days = [
      day('2026-05-14', 3),
      day('2026-05-13', 1),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(3);
  });

  it('skips today if zero contributions (streak from yesterday)', () => {
    const days = [
      day('2026-05-14', 0),
      day('2026-05-13', 5),
      day('2026-05-12', 2),
      day('2026-05-11', 0),
    ];
    expect(calculateStreak(days, '2026-05-14')).toBe(2);
  });

  it('returns 0 when yesterday is also zero', () => {
    const days = [day('2026-05-14', 0), day('2026-05-13', 0), day('2026-05-12', 5)];
    expect(calculateStreak(days, '2026-05-14')).toBe(0);
  });

  it('handles single day with contributions', () => {
    const days = [day('2026-05-14', 1)];
    expect(calculateStreak(days, '2026-05-14')).toBe(1);
  });
});

describe('parsePRState', () => {
  it('returns merged when merged_at is set', () => {
    expect(parsePRState('closed', '2026-05-01T00:00:00Z')).toBe('merged');
  });

  it('returns open when state is open and not merged', () => {
    expect(parsePRState('open', null)).toBe('open');
  });

  it('returns closed when state is closed and not merged', () => {
    expect(parsePRState('closed', null)).toBe('closed');
  });
});
```

- [ ] **Step 2: Run tests — expect FAIL (functions not yet exported)**

```bash
npx vitest run src/app/actions/github-sync.test.ts
```

Expected: `Cannot find module './github-sync'` or similar import error.

### Step 2b — Implement the action

- [ ] **Step 3: Create `src/app/actions/github-sync.ts`**

```typescript
'use server';

import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { cacheDel } from '@/lib/cache';
import { ok, err, type Result } from '@/lib/result';

export type GitHubPR = {
  id: string;
  title: string;
  repo_full_name: string;
  state: 'open' | 'closed' | 'merged';
  pr_number: number;
  pr_url: string;
  opened_at: string;
};

export type SyncOutput = {
  merges: number;
  streak: number;
  prs: GitHubPR[];
};

// Pure helper — exported for testing.
export function parsePRState(
  apiState: string,
  mergedAt: string | null,
): 'open' | 'closed' | 'merged' {
  if (mergedAt != null) return 'merged';
  if (apiState === 'open') return 'open';
  return 'closed';
}

// Pure helper — exported for testing.
// days: array from GraphQL contributionDays (any order, any date range).
// today: YYYY-MM-DD string representing the current date.
export function calculateStreak(
  days: { date: string; contributionCount: number }[],
  today: string,
): number {
  const sorted = [...days]
    .filter((d) => d.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let expectingDate: string | null = null;

  for (const day of sorted) {
    if (expectingDate === null) {
      // First entry: today
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        // Today is zero — check if yesterday has contributions
        expectingDate = prevDay(day.date);
        continue;
      }
    } else {
      if (day.date !== expectingDate) break; // gap in data
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        break;
      }
    }
  }

  return streak;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().split('T')[0];
}

async function fetchMergedCount(token: string, handle: string): Promise<number> {
  const res = await fetch(
    `https://api.github.com/search/issues?q=is:pr+is:merged+author:${handle}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub Search API ${res.status}`);
  const data = (await res.json()) as { total_count: number };
  return data.total_count;
}

async function fetchContributionStreak(token: string, login: string): Promise<number> {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { login, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const weeks =
    json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const days = weeks.flatMap((w) => w.contributionDays);
  const today = new Date().toISOString().split('T')[0];
  return calculateStreak(days, today);
}

async function fetchAllPRs(token: string, handle: string): Promise<GitHubPR[]> {
  const allPRs: GitHubPR[] = [];
  const maxPages = 3;

  for (let page = 1; page <= maxPages; page++) {
    const res = await fetch(
      `https://api.github.com/search/issues?q=is:pr+author:${handle}&sort=updated&per_page=100&page=${page}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28',
        },
      },
    );
    if (!res.ok) throw new Error(`GitHub Search API ${res.status}`);
    const data = (await res.json()) as {
      items: {
        node_id: string;
        title: string;
        number: number;
        html_url: string;
        state: string;
        repository_url: string;
        created_at: string;
        pull_request?: { merged_at: string | null };
      }[];
    };

    for (const item of data.items) {
      const repoFullName = item.repository_url.replace('https://api.github.com/repos/', '');
      const state = parsePRState(item.state, item.pull_request?.merged_at ?? null);
      allPRs.push({
        id: item.node_id,
        title: item.title,
        repo_full_name: repoFullName,
        state,
        pr_number: item.number,
        pr_url: item.html_url,
        opened_at: item.created_at,
      });
    }

    if (data.items.length < 100) break;
  }

  return allPRs;
}

export async function syncGitHubStats(): Promise<Result<SyncOutput>> {
  const sb = getServerSupabase();
  if (!sb) return err('not_configured', 'Auth not configured');

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) return err('not_authenticated', 'Sign in first');

  const sessionRes = await sb.auth.getSession();
  const providerToken = sessionRes.data.session?.provider_token;
  if (!providerToken) {
    return err(
      'no_token',
      'GitHub token unavailable. Sign out and sign in again.',
      true,
    );
  }

  const service = getServiceSupabase();
  if (!service) return err('not_configured', 'Service role not configured');

  const { data: profile } = await service
    .from('profiles')
    .select('github_handle')
    .eq('id', user.id)
    .single();
  if (!profile) return err('no_profile', 'Profile not found');

  try {
    const [merges, streak, prs] = await Promise.all([
      fetchMergedCount(providerToken, profile.github_handle),
      fetchContributionStreak(providerToken, profile.github_handle),
      fetchAllPRs(providerToken, profile.github_handle),
    ]);

    await service
      .from('profiles')
      .update({
        github_total_merges: merges,
        github_streak: streak,
        github_stats_synced_at: new Date().toISOString(),
      })
      .eq('id', user.id);

    // Replace: delete all then insert fresh batch
    await service.from('github_prs').delete().eq('user_id', user.id);
    if (prs.length > 0) {
      await service
        .from('github_prs')
        .insert(prs.map((pr) => ({ ...pr, user_id: user.id })));
    }

    await cacheDel(`gh:dashboard:${user.id}`);

    return ok({ merges, streak, prs });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Unknown error';
    if (msg.includes('429') || msg.toLowerCase().includes('rate limit')) {
      return err('rate_limited', 'GitHub rate limit reached. Try again shortly.', true);
    }
    return err('github_api_error', `GitHub API error: ${msg}`, true);
  }
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run src/app/actions/github-sync.test.ts
```

Expected output: all 8 tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/app/actions/github-sync.ts src/app/actions/github-sync.test.ts
git commit -m "feat: add syncGitHubStats server action with streak + PR helpers"
```

---

## Task 3: SyncButton Client Component

**Files:**
- Create: `src/app/(app)/dashboard/sync-button.tsx`

- [ ] **Step 1: Create `src/app/(app)/dashboard/sync-button.tsx`**

```tsx
'use client';

import { useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { RefreshCw } from 'lucide-react';
import { syncGitHubStats } from '@/app/actions/github-sync';

type Props = {
  lastSyncedAt: string | null;
};

export function SyncButton({ lastSyncedAt }: Props) {
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [cooldown, setCooldown] = useState(false);
  const [localSyncedAt, setLocalSyncedAt] = useState(lastSyncedAt);
  const router = useRouter();

  const handleSync = useCallback(async () => {
    if (syncing || cooldown) return;
    setSyncing(true);
    setError(null);

    const result = await syncGitHubStats();

    setSyncing(false);
    if (result.ok) {
      setLocalSyncedAt(new Date().toISOString());
      setCooldown(true);
      setTimeout(() => setCooldown(false), 60_000);
      router.refresh();
    } else {
      setError(result.error.message);
    }
  }, [syncing, cooldown, router]);

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleSync}
        disabled={syncing || cooldown}
        className="flex items-center gap-2 border border-zinc-700 px-4 py-3 text-[11px] font-bold uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50"
      >
        <RefreshCw className={`h-3 w-3 ${syncing ? 'animate-spin' : ''}`} />
        {syncing ? 'SYNCING...' : 'SYNC'}
      </button>
      <span className="text-[10px] uppercase tracking-widest text-zinc-600">
        {formatSyncedAt(localSyncedAt)}
      </span>
      {error && (
        <span className="max-w-[200px] text-right text-[10px] uppercase tracking-widest text-red-400">
          {error}
        </span>
      )}
    </div>
  );
}

function formatSyncedAt(iso: string | null): string {
  if (!iso) return 'NEVER SYNCED';
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60_000);
  if (mins < 1) return 'JUST NOW';
  if (mins < 60) return `LAST SYNCED ${mins}M AGO`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `LAST SYNCED ${hrs}H AGO`;
  return `LAST SYNCED ${Math.floor(hrs / 24)}D AGO`;
}
```

- [ ] **Step 2: Run the TypeScript compiler to verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors in `sync-button.tsx`.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/dashboard/sync-button.tsx
git commit -m "feat: add SyncButton client component with cooldown and last-synced label"
```

---

## Task 4: GitHubPRsPanel Client Component

**Files:**
- Create: `src/app/(app)/dashboard/github-prs-panel.tsx`

- [ ] **Step 1: Create `src/app/(app)/dashboard/github-prs-panel.tsx`**

```tsx
'use client';

import { useState } from 'react';
import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import type { GitHubPR } from '@/app/actions/github-sync';

type Props = {
  prs: GitHubPR[];
  claimedPrUrls: string[]; // plain array — serializable as RSC prop; convert to Set inside
  githubHandle: string;
};

type Filter = 'open' | 'closed' | 'merged';

export function GitHubPRsPanel({ prs, claimedPrUrls, githubHandle }: Props) {
  const [filter, setFilter] = useState<Filter>('open');
  const claimedSet = new Set(claimedPrUrls);

  const filtered = prs.filter((pr) => pr.state === filter).slice(0, 5);

  return (
    <section>
      <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
        <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">MY PRS</h2>
        <div className="flex items-center gap-4">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value as Filter)}
            className="cursor-pointer appearance-none border border-zinc-700 bg-[#1c2128] px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-zinc-300 focus:border-[#10b981] focus:outline-none"
          >
            <option value="open">Open</option>
            <option value="closed">Closed</option>
            <option value="merged">Merged</option>
          </select>
          <Link
            href={`https://github.com/${githubHandle}?tab=pull-requests`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
          >
            VIEW ALL <ArrowRight className="h-3 w-3" />
          </Link>
        </div>
      </div>

      <div className="space-y-6">
        {filtered.length === 0 ? (
          <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
            No {filter} PRs.
          </div>
        ) : (
          filtered.map((pr) => (
            <div key={pr.id} className="border-b border-[#2d333b] pb-6 last:border-0">
              <Link href={pr.pr_url} target="_blank" rel="noopener noreferrer">
                <h3 className="mb-1 text-[15px] text-white hover:underline">{pr.title}</h3>
              </Link>
              <div className="mb-3 text-[11px] uppercase tracking-widest text-zinc-500">
                #{pr.pr_number} · {pr.repo_full_name} · {formatDate(pr.opened_at)}
              </div>
              <div className="flex items-center gap-3">
                <StateBadge state={pr.state} />
                {claimedSet.has(pr.pr_url) && (
                  <span className="border border-purple-700 bg-purple-900/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-purple-300">
                    CLAIMED
                  </span>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </section>
  );
}

function StateBadge({ state }: { state: 'open' | 'closed' | 'merged' }) {
  if (state === 'merged') {
    return (
      <span className="border border-[#10b981] bg-[#064e3b]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#10b981]">
        MERGED ✓
      </span>
    );
  }
  if (state === 'open') {
    return (
      <span className="border border-[#b45309] bg-[#451a03]/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-[#fbbf24]">
        OPEN
      </span>
    );
  }
  return (
    <span className="border border-zinc-600 bg-zinc-800/30 px-2 py-0.5 text-[10px] uppercase tracking-widest text-zinc-400">
      CLOSED
    </span>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}
```

- [ ] **Step 2: Verify no type errors**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/(app)/dashboard/github-prs-panel.tsx
git commit -m "feat: add GitHubPRsPanel client component with open/closed/merged filter"
```

---

## Task 5: Update Dashboard Page

**Files:**
- Modify: `src/app/(app)/dashboard/page.tsx`

- [ ] **Step 1: Replace `src/app/(app)/dashboard/page.tsx` with the updated version**

```tsx
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { syncGitHubStats } from '@/app/actions/github-sync';
import { SyncButton } from './sync-button';
import { GitHubPRsPanel } from './github-prs-panel';
import { redirect } from 'next/navigation';
import { xpToNextLevel, xpForLevel } from '@/lib/xp/curve';
import { cacheGet, cacheSet } from '@/lib/cache';
import Link from 'next/link';
import { ArrowRight, TrendingUp, Box } from 'lucide-react';

export const dynamic = 'force-dynamic';

type DashboardCache = {
  merges: number | null;
  streak: number | null;
  syncedAt: string | null;
  prs: {
    id: string;
    title: string;
    repo_full_name: string;
    state: 'open' | 'closed' | 'merged';
    pr_number: number;
    pr_url: string;
    opened_at: string;
  }[];
};

export default async function DashboardPage() {
  const sb = getServerSupabase();
  if (!sb) return <NotConfigured />;

  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const service = getServiceSupabase();
  if (!service) return <NotConfigured />;

  const { data: profile } = await service
    .from('profiles')
    .select(
      'github_handle, xp, level, audit_completed, github_total_merges, github_streak, github_stats_synced_at',
    )
    .eq('id', user.id)
    .maybeSingle();

  const xp = profile?.xp ?? 0;
  const level = profile?.level ?? 0;
  const { needed, next } = xpToNextLevel(xp);
  const nextLevel = next ?? level;

  // Auto-sync on first ever load (no synced_at means never synced)
  if (!profile?.github_stats_synced_at) {
    await syncGitHubStats();
    // Re-fetch profile after sync
    const { data: refreshed } = await service
      .from('profiles')
      .select('github_total_merges, github_streak, github_stats_synced_at')
      .eq('id', user.id)
      .maybeSingle();
    if (refreshed) {
      Object.assign(profile ?? {}, refreshed);
    }
  }

  // Read GitHub stats from Redis cache, fall back to Supabase
  const cacheKey = `gh:dashboard:${user.id}`;
  let dashCache = await cacheGet<DashboardCache>(cacheKey);

  if (!dashCache) {
    const { data: prsData } = await service
      .from('github_prs')
      .select('id, title, repo_full_name, state, pr_number, pr_url, opened_at')
      .eq('user_id', user.id)
      .order('opened_at', { ascending: false });

    dashCache = {
      merges: profile?.github_total_merges ?? null,
      streak: profile?.github_streak ?? null,
      syncedAt: profile?.github_stats_synced_at ?? null,
      prs: (prsData ?? []) as DashboardCache['prs'],
    };
    await cacheSet(cacheKey, dashCache, 300); // 5 min TTL
  }

  // Active Issues: claimed recommendations for this user
  const { data: claimedRecs } = await service
    .from('recommendations')
    .select(
      `
      id,
      status,
      xp_reward,
      linked_pr_url,
      issues (
        title,
        repo_full_name
      )
    `,
    )
    .eq('user_id', user.id)
    .eq('status', 'claimed')
    .limit(2);

  // Claimed PR URLs for tagging in GitHubPRsPanel (plain array — must be serializable RSC prop)
  const claimedPrUrls = (claimedRecs ?? [])
    .map((r: any) => r.linked_pr_url)
    .filter(Boolean) as string[];

  // Mentor points
  const { data: mentorEvents } = await service
    .from('xp_events')
    .select('xp_delta')
    .eq('user_id', user.id)
    .in('source', ['review', 'help_review']);
  const mentorPoints = mentorEvents?.reduce((acc, e) => acc + (e.xp_delta || 0), 0) || 0;

  // Leaderboard
  const { data: leaders } = await service
    .from('profiles')
    .select('github_handle, xp')
    .order('xp', { ascending: false })
    .limit(4);

  // Mentees
  const { data: menteesData } = await service
    .from('help_requests')
    .select('id, pr_url, status, user_id')
    .eq('resolved_by', user.id)
    .in('status', ['open', 'escalated'])
    .limit(2);

  let enrichedMentees: any[] = [];
  if (menteesData && menteesData.length > 0) {
    const userIds = menteesData.map((m: any) => m.user_id);
    const { data: menteeProfiles } = await service
      .from('profiles')
      .select('id, github_handle')
      .in('id', userIds);
    enrichedMentees = menteesData.map((m: any) => {
      const p = menteeProfiles?.find((p) => p.id === m.user_id);
      return { ...m, github_handle: p?.github_handle || 'Unknown' };
    });
  }

  const merges = dashCache.merges;
  const streak = dashCache.streak;
  const syncedAt = dashCache.syncedAt;

  return (
    <div className="min-h-screen bg-[#111318] p-12 font-mono text-white">
      <div className="mx-auto max-w-6xl">
        {/* Header */}
        <header className="mb-12 flex flex-col justify-between gap-6 border-b border-[#2d333b] pb-6 md:flex-row md:items-end">
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              01 / DASHBOARD
            </div>
            <h1 className="font-serif text-4xl text-white">
              Welcome back, {profile?.github_handle ?? 'Contributor'}.
            </h1>
          </div>
          <div className="flex items-center gap-4">
            <SyncButton lastSyncedAt={syncedAt} />
            <button className="flex items-center gap-3 bg-[#10b981] px-6 py-3 text-[11px] font-bold uppercase tracking-widest text-black transition-colors hover:bg-[#059669]">
              DEPLOY LATEST <ArrowRight className="h-3 w-3" />
            </button>
          </div>
        </header>

        {/* Stats Row */}
        <div className="mb-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {/* Level Progress */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              LEVEL PROGRESS
            </div>
            <div className="flex items-center gap-4">
              <div className="border border-zinc-700 px-3 py-2 font-serif text-xl text-zinc-300">
                L{level}
              </div>
              <div className="flex-1">
                <div className="mb-2 h-1.5 w-full overflow-hidden bg-[#1c2128]">
                  <div
                    className="h-full bg-[#10b981]"
                    style={{ width: `${levelProgressPct(xp, level)}%` }}
                  />
                </div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                  {xp.toLocaleString()} / {(xp + needed).toLocaleString()} XP TO L{nextLevel}
                </div>
              </div>
            </div>
          </div>

          {/* Total Merges */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              TOTAL MERGES
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {merges != null ? merges.toString().padStart(2, '0') : '–'}
              </span>
              <TrendingUp className="mb-1 h-4 w-4 text-[#10b981]" />
            </div>
          </div>

          {/* Mentor Points */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              MENTOR POINTS
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {mentorPoints.toLocaleString()}
              </span>
              <Box className="mb-1 h-5 w-5 text-zinc-400" />
            </div>
          </div>

          {/* Current Streak */}
          <div>
            <div className="mb-4 text-[11px] uppercase tracking-widest text-zinc-500">
              CURRENT STREAK
            </div>
            <div className="flex items-end gap-2">
              <span className="font-serif text-4xl leading-none">
                {streak != null ? streak.toString().padStart(2, '0') : '–'}
              </span>
              <span className="mb-1 text-[10px] uppercase tracking-widest text-zinc-500">
                DAYS 🔥
              </span>
            </div>
          </div>
        </div>

        {/* Main Columns */}
        <div className="grid grid-cols-1 gap-16 lg:grid-cols-2">
          {/* Left Column */}
          <div className="space-y-16">
            {/* Active Issues */}
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  ACTIVE ISSUES
                </h2>
                <Link
                  href="/issues"
                  className="flex items-center gap-2 text-[11px] uppercase tracking-widest text-zinc-400 hover:text-white"
                >
                  BROWSE MORE <ArrowRight className="h-3 w-3" />
                </Link>
              </div>

              <div className="space-y-6">
                {claimedRecs && claimedRecs.length > 0 ? (
                  claimedRecs.map((rec: any, i: number) => {
                    const issue = rec.issues;
                    return (
                      <div
                        key={rec.id || i}
                        className="border-b border-[#2d333b] pb-6 last:border-0 last:pb-0"
                      >
                        <div className="mb-4 flex items-start justify-between">
                          <div className="flex gap-3">
                            <span className="border border-zinc-700 px-2 py-0.5 text-[10px] uppercase text-zinc-400">
                              {issue?.repo_full_name?.split('/')[1] || 'REPO'}
                            </span>
                            <span className="bg-white px-2 py-0.5 text-[10px] font-bold text-black">
                              L{level}
                            </span>
                          </div>
                          <span className="text-[10px] uppercase tracking-widest text-zinc-500">
                            CLAIMED
                          </span>
                        </div>
                        <h3 className="mb-5 font-serif text-2xl text-white">
                          {issue?.title || 'Unknown Issue'}
                        </h3>
                        <div className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-zinc-400">
                          <div className="h-2 w-2 bg-[#10b981]" />
                          IN PROGRESS
                        </div>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-sm text-zinc-500">
                    No active issues. Browse recommendations to claim one.
                  </div>
                )}
              </div>
            </section>

            {/* Mentees */}
            <section>
              <div className="mb-6 border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  YOUR MENTEES
                </h2>
              </div>
              <div className="space-y-4">
                {enrichedMentees && enrichedMentees.length > 0 ? (
                  enrichedMentees.map((mentee: any) => (
                    <div
                      key={mentee.id}
                      className="flex items-center justify-between border-b border-[#2d333b] pb-4"
                    >
                      <div className="flex items-center gap-4">
                        <div className="flex h-10 w-10 items-center justify-center border border-zinc-800 bg-[#1c2128] text-xs uppercase text-zinc-500">
                          {mentee.github_handle.substring(0, 2)}
                        </div>
                        <div>
                          <div className="text-xs font-bold uppercase tracking-widest text-zinc-200">
                            {mentee.github_handle}
                          </div>
                          <div className="text-sm text-zinc-400">
                            Help Request: {mentee.status}
                          </div>
                        </div>
                      </div>
                      <Link
                        href={mentee.pr_url || '#'}
                        className="border border-zinc-700 px-4 py-2 text-[10px] uppercase tracking-widest text-zinc-300 transition-colors hover:bg-zinc-800"
                      >
                        REVIEW DRAFT
                      </Link>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    No active mentees assigned to you.
                  </div>
                )}
              </div>
            </section>
          </div>

          {/* Right Column */}
          <div className="space-y-16">
            {/* My PRs */}
            <GitHubPRsPanel
              prs={dashCache.prs}
              claimedPrUrls={claimedPrUrls}  // string[] — serializable
              githubHandle={profile?.github_handle ?? ''}
            />

            {/* Leaderboard */}
            <section>
              <div className="mb-6 flex items-center justify-between border-b border-[#2d333b] pb-4">
                <h2 className="text-[11px] uppercase tracking-widest text-zinc-500">
                  LEADERBOARD SNAPSHOT
                </h2>
                <span className="text-[11px] uppercase tracking-widest text-zinc-500">
                  GLOBAL
                </span>
              </div>

              <div className="text-xs uppercase tracking-widest">
                {leaders && leaders.length > 0 ? (
                  leaders.map((leader, index) => {
                    const isMe = leader.github_handle === profile?.github_handle;
                    return (
                      <div
                        key={leader.github_handle}
                        className={`flex justify-between border-b border-[#2d333b] py-3.5 ${isMe ? '-mx-3 bg-[#3b0764]/40 px-3 text-purple-300' : 'text-zinc-400'}`}
                      >
                        <div className="flex gap-5">
                          <span className={`w-6 ${isMe ? 'opacity-50' : 'text-zinc-600'}`}>
                            {(index + 1).toString().padStart(2, '0')}
                          </span>
                          {leader.github_handle} {isMe && '(YOU)'}
                        </div>
                        <span>{leader.xp.toLocaleString()} XP</span>
                      </div>
                    );
                  })
                ) : (
                  <div className="py-4 text-[11px] uppercase tracking-widest text-zinc-500">
                    Leaderboard is empty.
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>

        {/* Footer */}
        <footer className="mt-24 flex justify-between border-t border-[#2d333b] pt-8 text-[10px] uppercase tracking-widest text-zinc-600">
          <span>©2024 ARCH_06 / SYSTEM_v1.0</span>
          <div className="flex gap-6">
            <Link href="#" className="transition-colors hover:text-zinc-400">TERMS</Link>
            <Link href="#" className="transition-colors hover:text-zinc-400">PRIVACY</Link>
            <Link href="#" className="transition-colors hover:text-zinc-400">SECURITY</Link>
          </div>
        </footer>
      </div>
    </div>
  );
}

function levelProgressPct(xp: number, level: number): number {
  const floor = xpForLevel(level);
  const ceiling = xpForLevel(level + 1);
  if (ceiling <= floor) return 100;
  const pct = ((xp - floor) / (ceiling - floor)) * 100;
  return Math.max(0, Math.min(100, pct));
}

function NotConfigured() {
  return (
    <div className="min-h-screen bg-[#111318] px-6 py-20 text-white">
      <div className="mx-auto max-w-xl">
        <h1 className="mb-4 font-serif text-3xl font-bold">Dashboard not configured</h1>
        <p className="text-gray-400">Auth isn&apos;t wired on this deployment yet.</p>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit
```

Expected: no errors across all dashboard files.

- [ ] **Step 3: Run all tests**

```bash
npx vitest run
```

Expected: all tests pass (including `github-sync.test.ts`).

- [ ] **Step 4: Commit**

```bash
git add src/app/(app)/dashboard/page.tsx
git commit -m "feat: wire dashboard to GitHub-synced stats and claimed active issues"
```

---

## Task 6: Final Verification

- [ ] **Step 1: Build the project**

```bash
npm run build
```

Expected: build completes without errors or type failures.

- [ ] **Step 2: Run dev server and manually verify**

```bash
npm run dev
```

Open `http://localhost:3000/dashboard`. Verify:
- No org dropdown in header
- SYNC button visible with "NEVER SYNCED" label
- Total Merges shows `–` before first sync
- Current Streak shows `–` before first sync
- Active Issues shows claimed recommendations only (or empty state)
- My PRs shows filter dropdown (Open / Closed / Merged)
- Click SYNC → button spins → page refreshes → stats populated from GitHub
- After sync: Total Merges shows real count, Streak shows real days
- My PRs: open PRs appear by default; switching filter shows closed/merged PRs
- CLAIMED tag appears on PRs whose URL matches a claimed recommendation
- Sync button disabled for 60s after sync; "LAST SYNCED Xm AGO" label shown

- [ ] **Step 3: Final commit**

```bash
git add -A
git commit -m "feat: dashboard GitHub data sync — real merges, streak, PRs from GitHub"
```
