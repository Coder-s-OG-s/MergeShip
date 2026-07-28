# Request Changes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a "Request Changes" GitHub review action to the maintainer dashboard via a new `/maintainer/pr/[id]` detail page with a Merge Decision panel.

**Architecture:** A new `requestChanges(prId, comment)` server action posts a `REQUEST_CHANGES` review to GitHub via `octokit.pulls.createReview`, mirroring the existing `closePullRequest` pattern exactly. A new Next.js server-component page at `/maintainer/pr/[id]` renders the PR title/metadata and a Merge Decision panel wired to two client buttons. The PR list in `maintainer/page.tsx` gains a `View →` link per row.

**Tech Stack:** Next.js 14 App Router, Supabase service client, Octokit (`@octokit/rest`), Vitest, `Result<T>` pattern, `requireMaintainer` auth guard, `RATE_LIMIT_TIERS.STANDARD` rate limiting.

## Global Constraints

- All commits MUST use `--author="axolotl5165 <axolotl5165@users.noreply.github.com>"` — no exceptions
- Push to `axolotl5165/MergeShip-1` fork remote (`axolotl`), PRs target `Coder-s-OG-s/MergeShip`
- `requireService: true` on every server action — service client is required
- Rate limit namespace `'maint:request-changes'` with `RATE_LIMIT_TIERS.STANDARD`
- Empty or whitespace-only comment → `err('invalid_input', 'Comment is required')` — checked AFTER scope verification
- No DB write after GitHub API call (review state lives on GitHub)
- `getInstallOctokit` already mocked in test file; need to add `createReview` to the mock

---

### Task 1: `requestChanges` server action, export, and tests

**Files:**
- Modify: `src/app/actions/maintainer/queue.ts` — append `requestChanges` function after `closePullRequest`
- Modify: `src/app/actions/maintainer/index.ts` — add `requestChanges` to `queue` exports
- Modify: `src/app/actions/maintainer.test.ts` — extend `getInstallOctokit` mock + add import + add 7 tests

**Interfaces:**
- Produces: `requestChanges(prId: number, comment: string): Promise<Result<{ ok: true }>>` — exported from barrel `src/app/actions/maintainer/index.ts`

- [ ] **Step 1: Append `requestChanges` to `src/app/actions/maintainer/queue.ts`**

Add this function after the closing `}` of `closePullRequest` (line 470):

```ts
export async function requestChanges(
  prId: number,
  comment: string,
): Promise<Result<{ ok: true }>> {
  const authRes = await requireMaintainer({
    rateLimit: { namespace: 'maint:request-changes', ...RATE_LIMIT_TIERS.STANDARD },
    requireService: true,
  });
  if (!authRes.ok) return authRes;
  const { user, service } = authRes.data;

  const { data: pr } = await service
    .from('pull_requests')
    .select('repo_full_name, number')
    .eq('id', prId)
    .maybeSingle();

  if (!pr) return err('not_found', 'PR not found');

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

  if (comment.trim().length === 0) {
    return err('invalid_input', 'Comment is required');
  }

  try {
    const octokit = await getInstallOctokit(installationId);
    const [owner, repo] = pr.repo_full_name.split('/');
    if (!owner || !repo) return err('invalid_input', 'Invalid repository format');
    await octokit.pulls.createReview({
      owner,
      repo,
      pull_number: pr.number,
      event: 'REQUEST_CHANGES',
      body: comment,
    });
  } catch (error: any) {
    return err('github_error', error.message || 'Failed to request changes via GitHub API');
  }

  return ok({ ok: true });
}
```

- [ ] **Step 2: Export `requestChanges` from the barrel**

In `src/app/actions/maintainer/index.ts`, change:

```ts
export {
  getMaintainerPrQueue,
  getMaintainerIssueQueue,
  refreshMaintainerBackfill,
  getPrCiStatus,
  closePullRequest,
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
} from './queue';
```

- [ ] **Step 3: Extend the `getInstallOctokit` mock in `src/app/actions/maintainer.test.ts`**

Find (lines 84–91):

```ts
const mockPullsUpdate = vi.fn();
vi.mock('@/lib/github/app', () => ({
  getInstallOctokit: vi.fn(() => ({
    pulls: {
      update: mockPullsUpdate,
    },
  })),
}));
```

Replace with:

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

- [ ] **Step 4: Add `requestChanges` to the import in `src/app/actions/maintainer.test.ts`**

Find the import block starting at line 1:

```ts
import {
  getMaintainerInstalls,
  ...
  closePullRequest,
  getNoiseBreakdown,
  getPromotionEligible,
} from './maintainer';
```

Add `requestChanges,` after `closePullRequest,`:

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
  getNoiseBreakdown,
  getPromotionEligible,
} from './maintainer';
```

- [ ] **Step 5: Add `requestChanges` describe block to `src/app/actions/maintainer.test.ts`**

Add this block after the closing `});` of the `closePullRequest` describe block (after line 1111), before `// getNoiseBreakdown`:

```ts
  // requestChanges

  describe('requestChanges', () => {
    beforeEach(() => {
      mockPullsCreateReview.mockClear();
    });

    it('returns rate_limited when rate limit exceeded', async () => {
      vi.mocked(rateLimitLib.rateLimit).mockResolvedValue({ ok: false } as never);

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('rate_limited');
    });

    it('returns not_found when PR does not exist in DB', async () => {
      mockFrom.mockReturnValueOnce(chain(null));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('PR not found');
      }
    });

    it('returns not_found when installation not found for repo', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(null));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('not_found');
        expect(res.error.message).toBe('Installation not found for this repository');
      }
    });

    it('returns not_authorised when repo not in maintainer scope', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/other']);

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('not_authorised');
    });

    it('returns invalid_input when comment is empty or whitespace', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);

      const res = await requestChanges(123, '   ');
      expect(res.ok).toBe(false);
      if (!res.ok) {
        expect(res.error.code).toBe('invalid_input');
        expect(res.error.message).toBe('Comment is required');
      }
    });

    it('returns github_error when GitHub API throws', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsCreateReview.mockRejectedValueOnce(new Error('GitHub error'));

      const res = await requestChanges(123, 'Please fix this');
      expect(res.ok).toBe(false);
      if (!res.ok) expect(res.error.code).toBe('github_error');
    });

    it('returns ok and calls createReview on success', async () => {
      const mockPr = { repo_full_name: 'org/repo', number: 42 };
      const mockRepo = { installation_id: 1 };
      mockFrom
        .mockReturnValueOnce(chain(mockPr))
        .mockReturnValueOnce(chain(mockRepo));
      vi.mocked(detect.listMaintainerRepos).mockResolvedValue(['org/repo']);
      mockPullsCreateReview.mockResolvedValueOnce({});

      const res = await requestChanges(123, 'Please address these issues');
      expect(res.ok).toBe(true);
      expect(mockPullsCreateReview).toHaveBeenCalledWith({
        owner: 'org',
        repo: 'repo',
        pull_number: 42,
        event: 'REQUEST_CHANGES',
        body: 'Please address these issues',
      });
    });
  });
```

- [ ] **Step 6: Run tests to verify all pass**

```bash
npx vitest run src/app/actions/maintainer.test.ts
```

Expected: all tests pass (previously 59 + 7 new = 66 total).

- [ ] **Step 7: Commit Task 1**

```bash
git add src/app/actions/maintainer/queue.ts src/app/actions/maintainer/index.ts src/app/actions/maintainer.test.ts
git commit --author="axolotl5165 <axolotl5165@users.noreply.github.com>" -m "feat(maintainer): add requestChanges server action and tests (#486)"
```

---

### Task 2: PR detail page, client buttons, and View → link

**Files:**
- Create: `src/app/(app)/maintainer/pr/[id]/page.tsx` — server component; auth guard, DB fetch, layout
- Create: `src/app/(app)/maintainer/pr/[id]/request-changes-button.tsx` — client component with expand-to-textarea flow
- Create: `src/app/(app)/maintainer/pr/[id]/close-pr-button.tsx` — client component
- Modify: `src/app/(app)/maintainer/page.tsx` — add `View →` Link per PR row

**Interfaces:**
- Consumes: `requestChanges` from `@/app/actions/maintainer` (Task 1)
- Consumes: `closePullRequest` from `@/app/actions/maintainer` (pre-existing)
- Consumes: `getServerSupabase` from `@/lib/supabase/server`
- Consumes: `getServiceSupabase` from `@/lib/supabase/service`
- Consumes: `isUserMaintainer`, `listMaintainerRepos` from `@/lib/maintainer/detect`
- Consumes: `isOk` from `@/lib/result`

- [ ] **Step 1: Create `src/app/(app)/maintainer/pr/[id]/request-changes-button.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { requestChanges } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function RequestChangesButton({ prId }: { prId: number }) {
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState('');
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleSubmit() {
    if (comment.trim().length === 0) return;
    setLoading(true);
    try {
      const res = await requestChanges(prId, comment);
      if (isOk(res)) {
        setOpen(false);
        setComment('');
        router.refresh();
      } else {
        alert(res.error.message);
      }
    } catch {
      alert('Failed to request changes');
    }
    setLoading(false);
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500"
      >
        Request Changes
      </button>
    );
  }

  return (
    <div className="w-full space-y-3">
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Leave a review comment..."
        rows={4}
        className="w-full rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-2 text-sm text-white placeholder-zinc-500 focus:border-zinc-500 focus:outline-none"
      />
      <div className="flex gap-2">
        <button
          onClick={() => {
            setOpen(false);
            setComment('');
          }}
          disabled={loading}
          className="rounded-lg px-4 py-2 text-sm text-zinc-400 hover:text-white disabled:opacity-50"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={loading || comment.trim().length === 0}
          className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-medium text-white hover:bg-amber-500 disabled:opacity-50"
        >
          {loading ? 'Submitting...' : 'Submit →'}
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Create `src/app/(app)/maintainer/pr/[id]/close-pr-button.tsx`**

```tsx
'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { closePullRequest } from '@/app/actions/maintainer';
import { isOk } from '@/lib/result';

export function ClosePrButton({ prId }: { prId: number }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleClose() {
    setLoading(true);
    try {
      const res = await closePullRequest(prId);
      if (isOk(res)) {
        router.push('/maintainer');
      } else {
        alert(res.error.message);
        setLoading(false);
      }
    } catch {
      alert('Failed to close PR');
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleClose}
      disabled={loading}
      className="rounded-lg border border-zinc-700 px-4 py-2 text-sm text-zinc-300 hover:bg-zinc-800 disabled:opacity-50"
    >
      {loading ? 'Closing...' : 'Close PR'}
    </button>
  );
}
```

- [ ] **Step 3: Create `src/app/(app)/maintainer/pr/[id]/page.tsx`**

```tsx
import { redirect, notFound } from 'next/navigation';
import Link from 'next/link';
import { getServerSupabase } from '@/lib/supabase/server';
import { getServiceSupabase } from '@/lib/supabase/service';
import { isUserMaintainer, listMaintainerRepos } from '@/lib/maintainer/detect';
import { RequestChangesButton } from './request-changes-button';
import { ClosePrButton } from './close-pr-button';

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

  const service = await getServiceSupabase();

  const { data: pr } = await service
    .from('pull_requests')
    .select('id, title, repo_full_name, number, author_login, author_user_id, state, draft, url, mentor_verified')
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
        <div className="flex flex-wrap gap-3">
          <RequestChangesButton prId={prId} />
          <ClosePrButton prId={prId} />
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Add `View →` link to each PR row in `src/app/(app)/maintainer/page.tsx`**

Find the closing part of the PR row `<li>` element. The current structure (lines 469–487) is:

```tsx
                {r.mentorVerified ? (
                  <span className="shrink-0 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                    ✓ Mentor verified
                    {r.mentorReviewerHandle && (
                      <span className="ml-1 text-emerald-400/80">
                        by @{r.mentorReviewerHandle}
                        {r.mentorReviewerLevel !== null && ` (L${r.mentorReviewerLevel})`}
                      </span>
                    )}
                  </span>
                ) : (
                  r.authorUserId !== user.id &&
                  r.state === 'open' && (
                    <div className="shrink-0">
                      <VerifyButton prId={r.id} />
                    </div>
                  )
                )}
              </li>
```

Replace with:

```tsx
                {r.mentorVerified ? (
                  <span className="shrink-0 rounded-full bg-emerald-900/40 px-2.5 py-0.5 text-xs font-medium text-emerald-300 ring-1 ring-emerald-700/40">
                    ✓ Mentor verified
                    {r.mentorReviewerHandle && (
                      <span className="ml-1 text-emerald-400/80">
                        by @{r.mentorReviewerHandle}
                        {r.mentorReviewerLevel !== null && ` (L${r.mentorReviewerLevel})`}
                      </span>
                    )}
                  </span>
                ) : (
                  r.authorUserId !== user.id &&
                  r.state === 'open' && (
                    <div className="shrink-0">
                      <VerifyButton prId={r.id} />
                    </div>
                  )
                )}
                <Link
                  href={`/maintainer/pr/${r.id}`}
                  className="shrink-0 text-sm text-zinc-400 hover:text-white"
                >
                  View →
                </Link>
              </li>
```

`Link` is already imported at the top of `maintainer/page.tsx` (line 1), so no new import is needed.

- [ ] **Step 5: Commit Task 2**

```bash
git add src/app/(app)/maintainer/pr/[id]/page.tsx src/app/(app)/maintainer/pr/[id]/request-changes-button.tsx src/app/(app)/maintainer/pr/[id]/close-pr-button.tsx src/app/(app)/maintainer/page.tsx
git commit --author="axolotl5165 <axolotl5165@users.noreply.github.com>" -m "feat(maintainer): add PR detail page with Request Changes and Close PR (#486)"
```

---

## Self-Review Checklist

**Spec coverage:**
- ✅ `requestChanges(prId, comment)` server action — Task 1 Step 1
- ✅ Export from barrel — Task 1 Step 2
- ✅ 7 tests (rate_limited, not_found PR, not_found installation, not_authorised, invalid_input, github_error, happy path) — Task 1 Steps 3–5
- ✅ PR detail page at `/maintainer/pr/[id]` — Task 2 Step 3
- ✅ `RequestChangesButton` client component — Task 2 Step 1
- ✅ `ClosePrButton` client component — Task 2 Step 2
- ✅ `View →` link in PR list — Task 2 Step 4

**No placeholders:** All steps contain exact code.

**Type consistency:**
- `requestChanges` exported from barrel, imported in both client buttons and test file ✅
- `closePullRequest` already exported from barrel, used in `ClosePrButton` ✅
- `prId: number` passed consistently from page → buttons ✅
