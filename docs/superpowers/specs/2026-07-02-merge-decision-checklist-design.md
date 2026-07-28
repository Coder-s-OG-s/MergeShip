# PR Review: Merge Decision Checklist — Design Spec

**Issue:** #485
**Date:** 2026-07-02
**Status:** Approved

---

## Summary

Add a Merge Decision checklist panel to the PR detail page (`/maintainer/pr/[id]`). A maintainer sees three pass/fail checks — Mentor Verified, No AI Flags, CI Passing — and a Merge PR button that is enabled only when all three pass. Request Changes and Close PR remain as secondary actions below a divider.

Trust Score (> 80) is intentionally excluded — it depends on issue #454 which has not landed. A separate tracking issue exists for adding it once #454 merges.

---

## Context

- PR detail page already exists at `src/app/(app)/maintainer/pr/[id]/page.tsx` (added in #531).
- `mentor_verified` is already fetched and in the DB (`pull_requests.mentor_verified`).
- `ai_flagged` is already in the DB (`pull_requests.ai_flagged`, set by the PR ingest pipeline) but not yet selected in the detail page query.
- CI status is fetched async via `getPrCiStatus(installationId, repoFullName, prNumber)` — same pattern used by `CiStatusBadge` in the queue.
- `closePullRequest` / `requestChanges` are the exact templates for `mergePullRequest`.

---

## Section 1: Server Action

### `mergePullRequest(prId: number)` — `src/app/actions/maintainer/queue.ts`

Flow (identical to `closePullRequest`):

1. `requireMaintainer({ rateLimit: { namespace: 'maint:merge-pr', ...RATE_LIMIT_TIERS.STANDARD }, requireService: true })`
2. Fetch PR from `pull_requests` by `prId` → `repo_full_name`, `number`, `state`
3. Guard: `pr.state !== 'open'` → `err('invalid_input', 'PR is not open')`
4. Fetch `installation_repositories` → `installation_id`
5. `listMaintainerRepos(user.id, installationId)` → `err('not_authorised')` if repo not in scope
6. `getInstallOctokit(installationId)` → `octokit.pulls.merge({ owner, repo, pull_number: pr.number, merge_method: 'squash' })`
7. Update `pull_requests.state = 'merged'` in DB
8. Return `ok({ ok: true })`

### Export

Added to `src/app/actions/maintainer/index.ts` under the `queue` exports.

### Tests — `src/app/actions/maintainer.test.ts`

Add `mockPullsMerge` alongside existing `mockPullsUpdate` / `mockPullsCreateReview` in the `getInstallOctokit` mock.

| Case | Assertion |
|------|-----------|
| Rate limited | `res.error.code === 'rate_limited'` |
| PR not found | `res.error.code === 'not_found'` |
| PR not open | `res.error.code === 'invalid_input'` |
| Installation not found | `res.error.code === 'not_found'` |
| Repo not in maintainer scope | `res.error.code === 'not_authorised'` |
| GitHub API throws | `res.error.code === 'github_error'` |
| Happy path | `res.ok === true`, `mockPullsMerge` called with `{ owner, repo, pull_number, merge_method: 'squash' }`, DB updated to `state: 'merged'` |

---

## Section 2: UI

### `MergeDecisionPanel` — `src/app/(app)/maintainer/pr/[id]/merge-decision-panel.tsx`

Client component. Receives all data it needs as props from the server-rendered page.

**Props:**
```ts
{
  prId: number;
  mentorVerified: boolean;
  aiFlagged: boolean;
  installationId: number;
  repoFullName: string;
  prNumber: number;
}
```

**State:** `ciStatus: 'passing' | 'failing' | 'pending' | null`, `ciLoading: boolean`, `merging: boolean`

**On mount:** fetches CI via `getPrCiStatus(installationId, repoFullName, prNumber)` — identical to `CiStatusBadge`.

**Checklist rows (3):**

| Label | Pass condition | Pass indicator | Fail indicator | Loading indicator |
|-------|---------------|----------------|----------------|-------------------|
| Mentor verified | `mentorVerified === true` | emerald ✓ | rose ✗ | — (static) |
| No AI flags detected | `aiFlagged === false` | emerald ✓ | rose ✗ | — (static) |
| CI Pipeline Passed | `ciStatus === 'passing'` | emerald ✓ | rose ✗ | zinc pulsing dot |

**Merge button:** enabled only when `mentorVerified && !aiFlagged && ciStatus === 'passing'`. Disabled (with `opacity-50`) otherwise.

**On merge click:**
- `setMerging(true)`
- Call `mergePullRequest(prId)`
- On success: `router.push('/maintainer')`
- On error: `alert(res.error.message)`, `setMerging(false)`

**Panel layout:**
```
┌─── Merge Decision ─────────────────────┐
│  ✓  Mentor verified                    │
│  ✗  No AI flags detected               │
│  ●  CI Pipeline Passed (loading…)      │
│                                        │
│  [Merge PR ↑]   ← disabled until all ✓│
│  ──────────────────────────────────    │
│  [Request Changes]      [Close PR]     │
└────────────────────────────────────────┘
```

### Page changes — `src/app/(app)/maintainer/pr/[id]/page.tsx`

1. Add `ai_flagged` to the PR `select()` query string.
2. Replace the current Merge Decision panel content with `<MergeDecisionPanel>` passing:
   - `prId`
   - `mentorVerified={pr.mentor_verified}`
   - `aiFlagged={pr.ai_flagged}`
   - `installationId={repoRow.installation_id}`
   - `repoFullName={pr.repo_full_name}`
   - `prNumber={pr.number}`
3. Remove the inline `<RequestChangesButton>` and `<ClosePrButton>` from the panel — they move inside `MergeDecisionPanel` below the divider.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/actions/maintainer/queue.ts` | Add `mergePullRequest` action |
| `src/app/actions/maintainer/index.ts` | Export `mergePullRequest` |
| `src/app/actions/maintainer.test.ts` | Add `mockPullsMerge` + 7 tests |
| `src/app/(app)/maintainer/pr/[id]/merge-decision-panel.tsx` | New client component |
| `src/app/(app)/maintainer/pr/[id]/page.tsx` | Add `ai_flagged` to select, wire `MergeDecisionPanel` |

No DB migrations needed — `ai_flagged` and `mentor_verified` already exist.

---

## Out of Scope

- Trust Score check (tracked separately, depends on #454)
- Configurable merge method (squash hardcoded)
- Merge commit message customisation
- PR diff viewer
