# PR Review: Request Changes — Design Spec

**Issue:** #486
**Date:** 2026-07-02
**Status:** Approved

---

## Summary

Add a "Request Changes" action to the maintainer dashboard. A maintainer can open a PR detail page, write a required review comment, and submit it — which posts a `REQUEST_CHANGES` review to GitHub via the installation Octokit. A "Close PR" button lives alongside it, reusing the existing `closePullRequest` action.

---

## Context

- `closePullRequest` in `src/app/actions/maintainer/queue.ts` is the exact template for the new action.
- `ResolveFlagButton` / `VerifyButton` are the UI patterns for client action buttons.
- No PR detail page exists today — PRs are listed in `maintainer/page.tsx` only.
- `getInstallOctokit(installationId)` provides the authenticated Octokit client.
- Review comment is **required** (empty string rejected before hitting GitHub).

---

## Section 1: Server Action

### `requestChanges(prId: number, comment: string)` — `src/app/actions/maintainer/queue.ts`

Flow (identical to `closePullRequest`):

1. `requireMaintainer({ rateLimit: { namespace: 'maint:request-changes', ...RATE_LIMIT_TIERS.STANDARD }, requireService: true })`
2. Fetch PR from `pull_requests` by `prId` → `repo_full_name`, `number`
3. Fetch `installation_repositories` → `installation_id`
4. `listMaintainerRepos(user.id, installationId)` → verify scope, `err('not_authorised')` if missing
5. `comment.trim().length === 0` → `err('invalid_input', 'Comment is required')`
6. `getInstallOctokit(installationId)` → `octokit.pulls.createReview({ owner, repo, pull_number, event: 'REQUEST_CHANGES', body: comment })`
7. Return `ok({ ok: true })` — no DB write (review state lives on GitHub)

### Export

Added to `src/app/actions/maintainer/index.ts` under the `queue` exports.

### Tests — `src/app/actions/maintainer.test.ts`

| Case | Assertion |
|------|-----------|
| Rate limited | `res.error.code === 'rate_limited'` |
| PR not found | `res.error.code === 'not_found'` |
| Repo not in maintainer scope | `res.error.code === 'not_authorised'` |
| Empty comment | `res.error.code === 'invalid_input'` |
| GitHub API throws | `res.error.code === 'github_error'` |
| Happy path | `res.ok === true` |

---

## Section 2: PR Detail Page

### Route

`src/app/(app)/maintainer/pr/[id]/page.tsx` — Next.js server component.

### Auth & data

- `requireMaintainer` → redirect `/` if not authorised
- Fetch PR from `pull_requests` by `id`: `title`, `repo_full_name`, `number`, `author_login`, `author_user_id`, `state`, `draft`, `url`, `mentor_verified`
- Fetch author from `profiles`: `github_handle`, `level`, `xp`
- `listMaintainerRepos` → if PR's repo not in scope, return 404 component

### Layout

```
/maintainer/pr/[id]
┌─────────────────────────────────────────────────┐
│ ← Back to PR Queue                              │
│                                                 │
│ [state badge] PR title                          │
│ @author · L{n} · repo/name · #number · [GH →]  │
│                                                 │
│ ┌─── Merge Decision ──────────────────────────┐ │
│ │  [Request Changes]        [Close PR]        │ │
│ │                                             │ │
│ │  (clicking Request Changes reveals:)        │ │
│ │  ┌───────────────────────────────────────┐  │ │
│ │  │ Leave a review comment...             │  │ │
│ │  │                                       │  │ │
│ │  └───────────────────────────────────────┘  │ │
│ │  [Cancel]                    [Submit →]     │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

### Client components

**`RequestChangesButton`** (`src/app/(app)/maintainer/pr/[id]/request-changes-button.tsx`):
- `useState` for `open` (textarea visible) + `loading`
- Textarea required, min 1 char enforced client-side before calling action
- On success: `router.refresh()` (review posted, page reflects updated state)
- On error: `alert(res.error.message)`

**`ClosePrButton`** (`src/app/(app)/maintainer/pr/[id]/close-pr-button.tsx`):
- Calls `closePullRequest(prId)`
- On success: `router.push('/maintainer')` (PR closed, return to queue)
- Same loading/error pattern as `RequestChangesButton`

### PR list wiring

In `src/app/(app)/maintainer/page.tsx`, each PR row gets a `View →` link:
```tsx
<Link href={`/maintainer/pr/${r.id}`} className="...">View →</Link>
```
Placed alongside the existing `VerifyButton`.

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/actions/maintainer/queue.ts` | Add `requestChanges` action |
| `src/app/actions/maintainer/index.ts` | Export `requestChanges` |
| `src/app/actions/maintainer.test.ts` | 6 tests for `requestChanges` |
| `src/app/(app)/maintainer/pr/[id]/page.tsx` | New PR detail page (server component) |
| `src/app/(app)/maintainer/pr/[id]/request-changes-button.tsx` | Client component |
| `src/app/(app)/maintainer/pr/[id]/close-pr-button.tsx` | Client component |
| `src/app/(app)/maintainer/page.tsx` | Add `View →` link per PR row |

No DB migrations needed.

---

## Out of Scope

- PR diff viewer
- Activity / comment timeline
- Merge pull request action
- Approve review action
