# Merge Decision Checklist Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Merge Decision checklist panel to the PR detail page with three pass/fail checks (Mentor Verified, No AI Flags, CI Passing) and a real GitHub Merge button gated behind all three.

**Architecture:** A new `mergePullRequest(prId)` server action mirrors `closePullRequest` exactly (auth → fetch → scope → GitHub API → DB update). A new `MergeDecisionPanel` client component receives DB-derived checks as props, fetches CI status on mount, gates the Merge button, and hosts the existing `RequestChangesButton` and `ClosePrButton` as secondary actions below a divider.

**Tech Stack:** Next.js 14 App Router, Supabase service client, Octokit (`@octokit/rest`), Vitest, `Result<T>` pattern, `requireMaintainer` auth guard, `RATE_LIMIT_TIERS.STANDARD`.

## Global Constraints

- All commits MUST use `--author="axolotl5165 <axolotl5165@users.noreply.github.com>"`
- Push to `axolotl5165/MergeShip-1` fork remote (`axolotl`), PRs target `Coder-s-OG-s/MergeShip`
- `requireService: true` on every server action
- Rate limit namespace `'maint:merge-pr'` with `RATE_LIMIT_TIERS.STANDARD`
- Merge method hardcoded as `'squash'` — no parameter
- `pr.state !== 'open'` guard → `err('invalid_input', 'PR is not open')` — checked BEFORE scope verification (fast-fail on bad state)
- DB updated to `state: 'merged'` after successful GitHub merge
- Trust Score check explicitly out of scope (tracked in separate issue #534)

---

### Task 1: `mergePullRequest` server action, export, and tests

**Files:**
- Modify: `src/app/actions/maintainer/queue.ts` — append `mergePullRequest` after `closePullRequest`
- Modify: `src/app/actions/maintainer/index.ts` — add `mergePullRequest` to queue exports
- Modify: `src/app/actions/maintainer.test.ts` — add `mockPullsMerge` to mock + import + 7 tests

**Interfaces:**
- Produces: `mergePullRequest(prId: number): Promise<Result<{ ok: true }>>` — exported from `src/app/actions/maintainer/index.ts`

- [ ] **Step 1: Add `mockPullsMerge` to the `getInstallOctokit` mock in `src/app/actions/maintainer.test.ts`**

Find (lines 84–92 on origin/main):

```ts
const mockPullsUpdate = vi.fn();
const mockPullsCreateReview = vi.fn();
vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: vi.fn(() => ({
    pulls: {
      update: mockPullsUpdate,
      createReview: mockPullsCreateReview,
    },
  })),
}));
```

Replace with:

```ts
const mockPullsUpdate = vi.fn();
const mockPullsCreateReview = vi.fn();
const mockPullsMerge = vi.fn();
vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: vi.fn(() => ({
    pulls: {
      update: mockPullsUpdate,
      createReview: mockPullsCreateReview,
      merge: mockPullsMerge,
    },
  })),
}));
```

- [ ] **Step 2: Add `mergePullRequest` to the import in `src/app/actions/maintainer.test.ts`**

Find the import block (starts at line 1). Add `mergePullRequest,` after `requestChanges,`:

```ts
import {
  getMaintainerInstalls,
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  getCommunityLinks,
  upsertCommunityLink,
  deleteCommunityLink,
  getRepoHealthOverview,
  getStaleIssues,
  getTopContributors,
  getFlaggedAccounts,
  getInstallationSettings,
  setMinContributorLevel,
  setAutoAssignMentorChain,
  getRepoPicker,
  setRepoManaged,
  resolveFlaggedAccount,
  getPrCiStatus,
  getReviewerLoad,
  closePullRequest,
  requestChanges,
  mergePullRequest,
  getNoiseBreakdown,
  getPromotionEligible,
} from './maintainer';
```

- [ ] **Step 3: Write the failing `mergePullRequest` tests in `src/app/actions/maintainer.test.ts`**

Add this describe block after the closing `});` of the `requestChanges` describe block, before `// getNoiseBreakdown`:

```ts
  // mergePullRequest

  describe('mergePullRequest', () => {
    beforeEach(() => {
      mockPullsMerge.mockClear();
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_found when PR does not exist in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns invalid_input when PR is not open', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'closed' };
      mockFrom.mockReturnValueOnce(chain(mockPr));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_input');
        expect(res.error.message).toBe('PR is not open');
      }
    });

    it('returns not_found when installation not found for repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(null));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('Installation not found for this repository');
      }
    });

    it('returns not_authorised when repo not in maintainer scope', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns github_error when GitHub API throws', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsMerge.mockRejectedValueOnce(new Error('GitHub error'));

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('github_error');
    });

    it('returns ok, calls merge with squash, and updates DB state to merged', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42, state: 'open' };
      const mockRepo = { installation_id: 1 };
      const updateChain = chain({ id: 123 });
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo))
        .mockReturnValueOnce(updateChain);
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsMerge.mockResolvedValueOnce({});

      const res = await mergePullRequest(123);
      expect(res.ok).toBe(true);
      expect(mockPullsMerge).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        merge_method: 'squash',
      });
      expect(updateChain.update).toHaveBeenCalledWith({ state: 'merged' });
    });
  });
```

- [ ] **Step 4: Run tests to verify the new tests fail (function not yet implemented)**

```bash
cd E:\Mergeship && npx vitest run src/app/actions/maintainer.test.ts 2>&1 | tail -20
```

Expected: several tests fail with `mergePullRequest is not a function` or similar.

- [ ] **Step 5: Append `mergePullRequest` to `src/app/actions/maintainer/queue.ts`**

Add this function after the closing `}` of `closePullRequest` (end of file):

```ts
export async function mergePullRequest(prId: number): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:merge-pr', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number, state')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return err('not_found', 'PR not found');

  if (pr.state !== 'open') return err('invalid_input', 'PR is not open');

  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) {
    return err('not_found', 'Installation not found for this repository');
  }
  const installationId = repoRow.installation_id;

  const scoped = await listMaintainerRepos(user.id, installationId);
  if (!scoped.includes(pr.repo_full_name)) {
    return err('not_authorised', 'You do not maintain this repository');
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = pr.repo_full_name.split('/');
    if (!owner || !repo) return err('invalid_input', 'Invalid repository format');
    await octokit.pulls.merge({
      owner,
      repo,
      pull_number: pr.number,
      merge_method: 'squash',
    });
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to merge PR via GitHub API');
  }

  const { error: updateErr } = await service
    .from('pull_requests')
    .update({ state: 'merged' })
    .eq('id', prId);

  if (updateErr) return err('persist_failed', updateErr.message);

  return ok({ ok: true });
}
```

- [ ] **Step 6: Export `mergePullRequest` from the barrel**

In `src/app/actions/maintainer/index.ts`, change:

```ts
export {
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  refreshMaintainerBackfill,
  getPrCiStatus,
  closePullRequest,
  requestChanges,
} from './queue';
```

to:

```ts
export {
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  refreshMaintainerBackfill,
  getPrCiStatus,
  closePullRequest,
  requestChanges,
  mergePullRequest,
} from './queue';
```

- [ ] **Step 7: Run tests to verify all pass**

```bash
cd E:\Mergeship && npx vitest run src/app/actions/maintainer.test.ts 2>&1 | tail -10
```

Expected: all tests pass (74 existing + 7 new = 81 total).

- [ ] **Step 8: Commit Task 1**

```bash
git add src/app/actions/maintainer/queue.ts src/app/actions/maintainer/index.ts src/app/actions/maintainer.test.ts
git commit --author="axolotl5165 <axolotl5165@users.noreply.github.com>" -m "feat(maintainer): add mergePullRequest server action and tests (#485)"
```

---

### Task 2: `MergeDecisionPanel` client component and page wiring

**Files:**
- Create: `src/app/(app)/maintainer/pr/[id]/merge-decision-panel.tsx` — client component; all checklist logic + merge button + secondary actions
- Modify: `src/app/(app)/maintainer/pr/[id]/page.tsx` — add `ai_flagged` to select, import `MergeDecisionPanel`, remove direct button imports, wire panel

**Interfaces:**
- Consumes: `mergePullRequest` from `@/app/actions/maintainer` (Task 1)
- Consumes: `getPrCiStatus` from `@/app/actions/maintainer` (pre-existing)
- Consumes: `closePullRequest`, `requestChanges` from `@/app/actions/maintainer` (pre-existing, used inside panel)
- Consumes: `isOk` from `@/lib/result`
- Consumes: `RequestChangesButton` from `./request-changes-button` (pre-existing file, unchanged)
- Consumes: `ClosePrButton` from `./close-pr-button` (pre-existing file, unchanged)

- [ ] **Step 1: Create `src/app/(app)/maintainer/pr/[id]/merge-decision-panel.tsx`**

```tsx
'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { getPrCiStatus, mergePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';

type CiStatus = 'passing' | 'failing' | 'pending' | null;

function CheckRow({
  label,
  pass,
  loading,
}: {
  label: string;
  pass: boolean;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="flex items-center gap-3 text-sm">
        <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-zinc-600" />
        <span className="text-zinc-400">{label}</span>
      </div>
    );
  }
  return (
    <div className="flex items-center gap-3 text-sm">
      <span
        className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-semibold ${
          pass
            ? 'bg-emerald-950/40 text-emerald-400 ring-1 ring-emerald-500/30'
            : 'bg-rose-950/40 text-rose-400 ring-1 ring-rose-500/30'
        }`}
      >
        {pass ? '✓' : '✗'}
      </span>
      <span className={pass ? 'text-zinc-300' : 'text-zinc-500'}>{label}</span>
    </div>
  );
}

export function MergeDecisionPanel({
  prId,
  mentorVerified,
  aiFlagged,
  installationId,
  repoFullName,
  prNumber,
}: {
  prId: number;
  mentorVerified: boolean;
  aiFlagged: boolean;
  installationId: number;
  repoFullName: string;
  prNumber: number;
}) {
  const [ciStatus, setCiStatus] = useState<CiStatus>(null);
  const [ciLoading, setCiLoading] = useState(true);
  const [merging, setMerging] = useState(false);
  const router = useRouter();

  useEffect(() => {
    let active = true;
    async function fetchCi() {
      const res = await getPrCiStatus(installationId, repoFullName, prNumber);
      if (active && isOk(res)) setCiStatus(res.data);
      if (active) setCiLoading(false);
    }
    fetchCi();
    return () => {
      active = false;
    };
  }, [installationId, repoFullName, prNumber]);

  const allPassing = mentorVerified && !aiFlagged && ciStatus === 'passing';

  async function handleMerge() {
    setMerging(true);
    try {
      const res = await mergePullRequest(prId);
      if (isOk(res)) {
        router.push('/maintainer');
      } else {
        alert(res.error.message);
        setMerging(false);
      }
    } catch {
      alert('Failed to merge PR');
      setMerging(false);
    }
  }

  return (
    <div>
      <div className="space-y-3">
        <CheckRow label="Mentor verified" pass={mentorVerified} />
        <CheckRow label="No AI flags detected" pass={!aiFlagged} />
        <CheckRow label="CI Pipeline Passed" pass={ciStatus === 'passing'} loading={ciLoading} />
      </div>

      <button
        onClick={handleMerge}
        disabled={!allPassing || merging}
        className="mt-4 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-600 disabled:opacity-50"
      >
        {merging ? 'Merging...' : 'Merge PR ↑'}
      </button>

      <div className="my-4 border-t border-zinc-800" />

      <div className="flex flex-wrap gap-3">
        <RequestChangesButton prId={prId} />
        <ClosePrButton prId={prId} />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Update `src/app/(app)/maintainer/pr/[id]/page.tsx`**

The full updated file (replace entirely):

```tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
import { MergeDecisionPanel } from './merge-decision-panel';

export const dynamic = 'force-dynamic';

export default async function PrDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const prId = Number(id);
  if (isNaN(prId)) return notFound();

  const sb = await getServerSupabase();
  if (!sb) redirect('/');
  const {
    data: { user },
  } = await sb.auth.getUser();
  if (!user) redirect('/');

  const isMaintainer = await isUserMaintainer(user.id);
  if (!isMaintainer) redirect('/');

  const service = getServiceSupabase();
  if (!service) return notFound();

  const { data: pr } = await service
    .from('pull_requests')
    .select(
      'id, title, repo_full_name, number, author_login, author_user_id, state, draft, url, mentor_verified, ai_flagged',
    )
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return notFound();

  const { data: repoRow } = await service
    .from('installation_repositories')
    .select('installation_id')
    .eq('repo_full_name', pr.repo_full_name)
    .maybeSingle();

  if (!repoRow?.installation_id) return notFound();

  const scoped = await listMaintainerRepos(user.id, repoRow.installation_id);
  if (!scoped.includes(pr.repo_full_name)) return notFound();

  const { data: profile } = pr.author_user_id
    ? await service
        .from('profiles')
        .select('github_handle, level, xp')
        .eq('id', pr.author_user_id)
        .maybeSingle()
    : { data: null };

  const stateColor =
    pr.state === 'open'
      ? 'bg-emerald-900/40 text-emerald-300'
      : pr.state === 'merged'
        ? 'bg-purple-900/40 text-purple-300'
        : 'bg-zinc-800 text-zinc-400';

  return (
    <div className="mx-auto max-w-2xl px-4 py-10">
      <Link
        href="/maintainer"
        className="mb-6 flex items-center gap-1 text-sm text-zinc-400 hover:text-white"
      >
        ← Back to PR Queue
      </Link>

      <div className="mb-6">
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${stateColor}`}>
            {pr.state}
          </span>
          {pr.draft && (
            <span className="rounded-full bg-zinc-800 px-2 py-0.5 text-xs text-zinc-400">
              Draft
            </span>
          )}
        </div>
        <h1 className="font-display text-2xl font-bold text-white">{pr.title}</h1>
        <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-zinc-400">
          <span>@{pr.author_login ?? 'unknown'}</span>
          {profile && <span>· L{profile.level}</span>}
          <span>
            · {pr.repo_full_name} #{pr.number}
          </span>
          <a
            href={pr.url}
            target="_blank"
            rel="noreferrer"
            className="text-zinc-400 hover:text-white"
          >
            GH →
          </a>
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900 p-6">
        <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-zinc-400">
          Merge Decision
        </h2>
        {pr.state === 'open' ? (
          <MergeDecisionPanel
            prId={prId}
            mentorVerified={pr.mentor_verified}
            aiFlagged={pr.ai_flagged}
            installationId={repoRow.installation_id}
            repoFullName={pr.repo_full_name}
            prNumber={pr.number}
          />
        ) : (
          <p className="text-sm text-zinc-500">
            This PR is already {pr.state} — no actions available.
          </p>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Run the full test suite to confirm no regressions**

```bash
cd E:\Mergeship && npx vitest run src/app/actions/maintainer.test.ts 2>&1 | tail -10
```

Expected: all 81 tests pass.

- [ ] **Step 4: Commit Task 2**

```bash
git add src/app/(app)/maintainer/pr/[id]/merge-decision-panel.tsx src/app/(app)/maintainer/pr/[id]/page.tsx
git commit --author="axolotl5165 <axolotl5165@users.noreply.github.com>" -m "feat(maintainer): add merge decision checklist panel (#485)"
```

---

## Self-Review

**Spec coverage:**
- ✅ `mergePullRequest(prId)` server action — Task 1 Step 5
- ✅ `merge_method: 'squash'` hardcoded — Task 1 Step 5
- ✅ `pr.state !== 'open'` guard → `invalid_input` — Task 1 Step 5
- ✅ DB updated to `state: 'merged'` — Task 1 Step 5
- ✅ Export from barrel — Task 1 Step 6
- ✅ `mockPullsMerge` added to mock — Task 1 Step 1
- ✅ 7 tests (rate_limited, not_found PR, invalid_input, not_found installation, not_authorised, github_error, happy path with squash + DB assertion) — Task 1 Step 3
- ✅ `MergeDecisionPanel` with 3 check rows — Task 2 Step 1
- ✅ CI fetched on mount via `getPrCiStatus` — Task 2 Step 1
- ✅ Merge button gated on `mentorVerified && !aiFlagged && ciStatus === 'passing'` — Task 2 Step 1
- ✅ `RequestChangesButton` + `ClosePrButton` as secondary actions — Task 2 Step 1
- ✅ `ai_flagged` added to page select — Task 2 Step 2
- ✅ Page wired to `MergeDecisionPanel` — Task 2 Step 2
- ✅ Trust Score explicitly excluded — out of scope

**No placeholders:** all steps contain exact code.

**Type consistency:**
- `mergePullRequest` exported from barrel, imported in `MergeDecisionPanel` ✅
- `MergeDecisionPanel` props match what page.tsx passes ✅
- `CiStatus` type consistent between state declaration and `allPassing` check ✅
