# Simplify install wizard to a single step

## Problem

`/install` shows a 3-step wizard (Install App → Pick Repos → Done). Step 2
calls `getRepoPicker()` as soon as the page loads after the GitHub App
install redirect. Repo discovery happens asynchronously via an Inngest job
(`process-installation-event.ts`) triggered by GitHub's `installation.created`
webhook. If the user's browser reaches `/install` before that job finishes,
`getRepoPicker` returns an empty array — the wizard still advances to Step 2
because `installationId` is already resolved, and renders "No repositories
match" with an empty, unusable filter list.

Separately, repos are already `managed = true` by default at the DB level
(migration `0018_installation_repo_managed.sql`). Step 2 only exists to let
maintainers opt specific repos *out* of management — it's not required to
get repos managed in the first place. That makes the step, and the race
condition it exposes, avoidable rather than something to patch around.

## Change

Collapse `src/app/install/install-wizard.tsx` to a single screen:

- Keep the existing Step 1 content (headline, "Install MergeShip on GitHub"
  button, dev-only skip-install button, permissions blurb) as the entire
  wizard.
- Remove Step 2 (repo picker) and Step 3 ("you're all set") components and
  the step-indicator chrome (`STEP {n} OF 3`, the three-dot header
  progress indicator) since there's only one step now.

In `src/app/install/page.tsx`:

- Once an `installationId` is resolved (either already linked or
  back-linked by account_login), redirect straight to `/onboarding/analyze`
  instead of calling `getRepoPicker()` and conditionally rendering
  steps 2/3. This removes the dependency on repo rows existing yet, which
  removes the race condition.
- Drop the now-unused `initialRepos`/`getRepoPicker` wiring from this page
  and the `InstallWizard` props (`installationId`, `initialRepos` are no
  longer needed by the wizard).

## Out of scope

- `RepoPicker` component (`src/app/onboarding/repos/repo-picker.tsx`),
  `/onboarding/repos` ("Adjust repos" page), and the `setRepoManaged`
  server action are untouched — they remain the supported way to opt
  specific repos out of management after onboarding.
- No database changes — `managed` already defaults to `true`.
- No changes to the Inngest installation-event processing.

## Testing

- `npm run typecheck`, `npm run lint`, `npm run format:check`,
  `npm run test:coverage` must all pass locally before pushing (mirrors CI
  in `.github/workflows/ci.yml`).
- No existing automated tests reference `install-wizard.tsx` directly, so
  none need updating for this change.

## Rollout

Per explicit user instruction, this lands as a direct commit to `main`
(no PR), after local verification that all four CI checks pass.
