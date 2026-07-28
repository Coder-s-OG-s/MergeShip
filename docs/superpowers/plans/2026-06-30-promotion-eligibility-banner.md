# Promotion Eligibility Banner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a banner to the maintainer dashboard that surfaces contributors within 10% of their next XP level threshold.

**Architecture:** New `getPromotionEligible` server action queries `xp_events` (scoped to install's repos) to find contributor IDs, then reads `profiles.xp`/`profiles.level` directly as the authoritative cached values. Eligibility math runs in TypeScript using the existing `xpForLevel` helper. The banner renders above the "Suspicious XP Signals" section in `maintainer/page.tsx`.

**Tech Stack:** Next.js 15 server components, Supabase service client, Vitest, Tailwind CSS

## Global Constraints

- No DB migrations — query existing `xp_events` and `profiles` tables only
- Leveling is automatic; banner is navigation-only (no approval actions)
- Follow existing auth pattern: `requireMaintainer()` + `RATE_LIMIT_TIERS.STANDARD`
- Use Supabase service client (not Drizzle) to stay consistent with similar actions in this file
- Return up to 10 results, sorted by `xpNeeded ASC` (closest to next level first)
- Threshold: `xp >= xpForLevel(level + 1) - Math.floor((xpForLevel(level + 1) - xpForLevel(level)) * 0.1)`
- Exclude contributors at `MAX_LEVEL` (5) — no next level exists

---

### Task 1: Server action + type

**Files:**
- Modify: `src/app/actions/maintainer/types.ts`
- Modify: `src/app/actions/maintainer/analytics.ts`
- Modify: `src/app/actions/maintainer/index.ts`
- Test: `src/app/actions/maintainer.test.ts`

**Interfaces:**
- Consumes: `xpForLevel`, `MAX_LEVEL` from `@/lib/xp/curve`, `requireMaintainer` from `@/lib/action-auth`, `listMaintainerRepos` from `@/lib/maintainer/detect`, `RATE_LIMIT_TIERS` from `@/lib/rate-limit`
- Produces: `getPromotionEligible({ installationId: number }): Promise<Result<PromotionEligibleRow[]>>` and `PromotionEligibleRow` type

- [ ] **Step 1: Add `PromotionEligibleRow` type**

In `src/app/actions/maintainer/types.ts`, add after `ReviewerLoadRow`:

```ts
export type PromotionEligibleRow = {
  githubHandle: string;
  xp: number;
  level: number;
  xpNeeded: number;
};
```

- [ ] **Step 2: Write failing tests**

Add to `src/app/actions/maintainer.test.ts`:

At the top of the file, add `getPromotionEligible` to the import:
```ts
import {
  // ...existing imports...
  getPromotionEligible,
} from './maintainer';
```

Add this describe block at the end of the outer `describe('maintainer actions', ...)`:

```ts
describe('getPromotionEligible', () => {
  beforeEach(() => {
    vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
  });

  it('returns rate_limited when rate limit exceeded', async () => {
    vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);
    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('rate_limited');
  });

  it('returns empty array when maintainer has no repos', async () => {
    vi.mocked(detect.listMaintainerRepos).mockResolvedValue([]);
    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('returns empty array when no XP events exist in scoped repos', async () => {
    mockFrom.mockReturnValueOnce(chain([]));
    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('returns eligible contributors sorted by xpNeeded ASC', async () => {
    // L1→L2: threshold=459, gap=359, floor(35.9)=35, trigger=424
    //   alice: xp=430 >= 424 ✓  xpNeeded=29
    //   bob:   xp=400 < 424  ✗
    // L2→L3: threshold=1119, gap=660, floor(66)=66, trigger=1053
    //   carol: xp=1100 >= 1053 ✓  xpNeeded=19
    mockFrom
      .mockReturnValueOnce(chain([{ user_id: 'u1' }, { user_id: 'u2' }, { user_id: 'u3' }]))
      .mockReturnValueOnce(
        chain([
          { github_handle: 'alice', xp: 430, level: 1 },
          { github_handle: 'bob', xp: 400, level: 1 },
          { github_handle: 'carol', xp: 1100, level: 2 },
        ]),
      );

    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data).toHaveLength(2);
      // sorted by xpNeeded ASC: carol(19) before alice(29)
      expect(res.data[0]?.githubHandle).toBe('carol');
      expect(res.data[0]?.xpNeeded).toBe(19);
      expect(res.data[1]?.githubHandle).toBe('alice');
      expect(res.data[1]?.xpNeeded).toBe(29);
    }
  });

  it('excludes contributors already at MAX_LEVEL (L5)', async () => {
    mockFrom
      .mockReturnValueOnce(chain([{ user_id: 'u1' }]))
      .mockReturnValueOnce(chain([{ github_handle: 'maxed', xp: 3500, level: 5 }]));

    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toEqual([]);
  });

  it('returns at most 10 results', async () => {
    const eventRows = Array.from({ length: 15 }, (_, i) => ({ user_id: `u${i}` }));
    // All at L1 with xp=430 (within 10% of L2 threshold 459)
    const profileRows = Array.from({ length: 15 }, (_, i) => ({
      github_handle: `user${i}`,
      xp: 430,
      level: 1,
    }));

    mockFrom.mockReturnValueOnce(chain(eventRows)).mockReturnValueOnce(chain(profileRows));

    const res = await getPromotionEligible({ installationId: 1 });
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.data).toHaveLength(10);
  });
});
```

- [ ] **Step 3: Run tests to confirm they fail**

```bash
npx vitest run src/app/actions/maintainer.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: multiple FAIL lines referencing `getPromotionEligible` not being defined/exported.

- [ ] **Step 4: Implement `getPromotionEligible`**

Add to `src/app/actions/maintainer/analytics.ts` (after the existing imports, add `MAX_LEVEL` and `xpForLevel` to the import from curve, and add `PromotionEligibleRow` to the types import):

At the top of the file, update imports:
```ts
import { xpForLevel, MAX_LEVEL } from '@/lib/xp/curve';
import {
  type RepoHealthRow,
  type StaleIssueRow,
  type ContributorRow,
  type ReviewerLoadRow,
  type PromotionEligibleRow,
} from './types';
```

Then add this function at the end of the file:

```ts
export async function getPromotionEligible(args: {
  installationId: number;
}): Promise<Result<PromotionEligibleRow[]>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maintainer', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const repos = await listMaintainerRepos(user.id, args.installationId);
  if (repos.length === 0) return ok([]);

  const { data: eventRows, error: eventError } = await service
    .from('xp_events')
    .select('user_id')
    .in('repo', repos);

  if (eventError) return err('query_failed', eventError.message);

  const userIds = Array.from(
    new Set((eventRows ?? []).map((r) => r.user_id).filter((id): id is string => Boolean(id))),
  );
  if (userIds.length === 0) return ok([]);

  const { data: profileRows, error: profileError } = await service
    .from('profiles')
    .select('github_handle, xp, level')
    .in('id', userIds);

  if (profileError) return err('query_failed', profileError.message);

  const eligible: PromotionEligibleRow[] = [];
  for (const p of profileRows ?? []) {
    if (p.level >= MAX_LEVEL) continue;
    const nextThreshold = xpForLevel(p.level + 1);
    const gap = nextThreshold - xpForLevel(p.level);
    const triggerXp = nextThreshold - Math.floor(gap * 0.1);
    if (p.xp >= triggerXp) {
      eligible.push({
        githubHandle: p.github_handle,
        xp: p.xp,
        level: p.level,
        xpNeeded: nextThreshold - p.xp,
      });
    }
  }

  eligible.sort((a, b) => a.xpNeeded - b.xpNeeded);
  return ok(eligible.slice(0, 10));
}
```

- [ ] **Step 5: Export from index**

In `src/app/actions/maintainer/index.ts`, add `getPromotionEligible` to the analytics export:

```ts
export {
  getRepoHealthOverview,
  getStaleIssues,
  getTopContributors,
  getMaintainerAnalyticsTrends,
  exportPrQueueCsv,
  getReviewerLoad,
  getPromotionEligible,
} from './analytics';
```

- [ ] **Step 6: Run tests and confirm they pass**

```bash
npx vitest run src/app/actions/maintainer.test.ts --reporter=verbose 2>&1 | tail -30
```

Expected: all `getPromotionEligible` tests PASS, no regressions in existing tests.

- [ ] **Step 7: Commit**

```bash
git add src/app/actions/maintainer/types.ts src/app/actions/maintainer/analytics.ts src/app/actions/maintainer/index.ts src/app/actions/maintainer.test.ts
git commit -m "feat(maintainer): add getPromotionEligible server action (#451)"
```

---

### Task 2: Banner UI in maintainer page

**Files:**
- Modify: `src/app/(app)/maintainer/page.tsx`

**Interfaces:**
- Consumes: `getPromotionEligible` and `PromotionEligibleRow` from `@/app/actions/maintainer`

- [ ] **Step 1: Import the new action and type**

In `src/app/(app)/maintainer/page.tsx`, add to the existing import from `@/app/actions/maintainer`:

```ts
import {
  // ...existing imports...
  getPromotionEligible,
  type PromotionEligibleRow,
} from '@/app/actions/maintainer';
```

- [ ] **Step 2: Fetch promotion-eligible contributors**

In the `MaintainerPage` component body, alongside the other parallel data fetches (after `reviewerLoadsRes`), add:

```ts
const promotionEligibleRes = await getPromotionEligible({ installationId: activeInstallId });
const promotionEligible: PromotionEligibleRow[] = isOk(promotionEligibleRes)
  ? promotionEligibleRes.data
  : [];
```

- [ ] **Step 3: Render the banner above "Suspicious XP Signals"**

In the JSX return, directly before the `{flaggedAccounts.length > 0 && (` block, add:

```tsx
{promotionEligible.length > 0 && (
  <section className="mb-8 rounded-2xl border border-emerald-900/60 bg-emerald-950/20 p-5">
    <div className="mb-4 flex items-center justify-between gap-3">
      <div>
        <h2 className="text-sm font-semibold text-emerald-100">Promotion Eligible</h2>
        <p className="mt-1 text-xs text-emerald-200/70">
          These contributors are within 10% of their next level.
        </p>
      </div>
      <span className="rounded-full bg-emerald-900/50 px-2 py-1 text-xs text-emerald-100">
        {promotionEligible.length} contributor{promotionEligible.length !== 1 ? 's' : ''}
      </span>
    </div>
    <div className="grid gap-3 md:grid-cols-2">
      {promotionEligible.map((c) => (
        <div key={c.githubHandle} className="rounded-lg border border-emerald-900/50 p-3">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm text-emerald-50">@{c.githubHandle}</p>
              <p className="mt-1 text-xs text-emerald-200/70">
                L{c.level} · {c.xp.toLocaleString()} XP
              </p>
            </div>
            <div className="flex shrink-0 items-center gap-3">
              <span className="text-xs text-emerald-200/50">
                {c.xpNeeded} XP to L{c.level + 1}
              </span>
              <Link
                href={`/@${c.githubHandle}`}
                className="text-xs text-emerald-400 hover:text-emerald-300"
              >
                Review profile →
              </Link>
            </div>
          </div>
        </div>
      ))}
    </div>
  </section>
)}
```

- [ ] **Step 4: Type-check**

```bash
npx tsc --noEmit 2>&1 | head -40
```

Expected: no errors relating to the new code.

- [ ] **Step 5: Commit**

```bash
git add src/app/(app)/maintainer/page.tsx
git commit -m "feat(maintainer): render promotion-eligibility alert banner (#451)"
```
