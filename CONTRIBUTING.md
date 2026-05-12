# Contributing to MergeShip

Glad you're here. This guide gets you from clone to first PR in under 10 minutes.

## Local setup

You need:

- Node 20+
- Docker (for the local Supabase)
- npm

Steps:

```bash
git clone https://github.com/Coder-s-OG-s/MergeShip
cd MergeShip
npm install
cp .env.example .env.local
make supabase-start    # local Supabase: Postgres + Auth + Studio in Docker
make db-seed           # seed synthetic personas (Alice/Bob/Carol/Dave/Eve/Frank)
npm run dev
```

Open http://localhost:3001 (the dev script uses port 3001).

## Sign in without real GitHub OAuth

We seed six dev personas so contributors don't need to configure a personal GitHub OAuth App for local work. Hit http://localhost:3001/dev/login and click a persona — instant sign-in via Supabase email/password.

The page returns 404 in production.

## Layout

```
src/
  app/
    (app)/           # authenticated routes (dashboard, onboarding, leaderboard)
    [handle]/        # public profile pages /@username
    api/             # auth callback, webhooks, inngest
    actions/         # server actions (profile, recommendations, course, help)
  lib/
    cache.ts         # redis (or in-memory in tests)
    rate-limit.ts
    result.ts        # Result<T> error envelope
    db/              # drizzle schema + client
    github/          # octokit factories, webhook hmac verify
    llm/             # groq router + zod schemas
    pipeline/        # difficulty scoring, rec ranking
    xp/              # curve, events, caps, audit, sources
    help/            # dispatch ring logic
    course/          # course content + grader
    supabase/        # browser, server, service clients
  inngest/
    functions/       # audit-run, process-pr-event, help-dispatch, ...
  middleware.ts      # session refresh + install gate
supabase/migrations  # SQL migrations (drizzle generated + handwritten)
tests/               # integration test fixtures, setup
__fixtures__/        # canned external responses for tests
docs/                # deployment guide, architecture diagrams
scripts/             # seed, sim-webhook
```

## Engineering bar

Hard rules — CI fails if any of these break:

- `npm run typecheck` — zero errors (strict mode)
- `npm run lint` — zero warnings
- `npm run format:check` — Prettier clean
- `npm test` — all passing
- Coverage on `lib/` ≥ 80%

Rules in your code:

- **Tests required** for any change to `src/lib/`, `src/inngest/`, `src/app/actions/`, or `src/app/api/`
- **No `any` types.** Use `unknown` + narrowing
- **No raw `fetch` to GitHub.** Always go through `lib/github/app.ts` factories
- **No `console.log` in committed code.** Use `console.warn` or `console.error` in scripts/tests
- **DRY** — grep `src/lib/` before writing a new helper
- **Comments explain WHY, not WHAT.** If you need a comment to say what code does, refactor

## Test layout

- Unit tests live next to source: `foo.ts` + `foo.test.ts`
- Integration tests in `tests/integration/`
- Webhook replay fixtures in `__fixtures__/webhooks/`
- Run `npm run test:watch` for TDD inner loop

## Common tasks

```bash
make dev              # full stack (supabase + next dev)
make test             # vitest run
make test-watch       # TDD mode
make db-reset         # nuke + reseed local DB
make db-studio        # Drizzle Studio
make sim-webhook -- pr-merged --handle bob --repo demo/sample --pr 1
make lint
make typecheck
make format
make build            # next build (catches type errors in pages)
```

## Pull request flow

1. Branch off `main`: `git checkout -b feat/short-name`
2. Make small focused changes — one PR per problem
3. Write tests **first** for any logic change (TDD)
4. Run `make test`, `make typecheck`, `make lint`, `make format` before pushing
5. Open the PR using the template
6. CI green + one approval → merge

### Commit messages

Conventional commits, lowercase:

```
feat(xp): mentor bonus stacks with speed bonus
fix(claim): atomic update prevents double-claim race
test(audit): edge cases for fresh-account scoring
docs: add deployment guide
refactor: extract repo health into pure function
```

No multi-paragraph commit bodies for trivial changes. One short line is fine.

## What we don't accept

- PRs that turn off lint rules to "make it pass"
- PRs without tests for logic changes
- PRs that touch 30 files without a clear single purpose
- PRs that bypass the install gate

## Where to get help

- Open a draft PR early and tag a maintainer for direction
- Bigger architectural changes → open an issue first to discuss
- Check `docs/architecture/` for the system design before proposing structural changes
