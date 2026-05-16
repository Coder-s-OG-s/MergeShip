# Contributing to MergeShip

Welcome. This guide gets you from `git clone` to a running local app, then walks you through opening your first PR. Should take 15-20 minutes the first time.

Works the same on **macOS**, **Linux**, and **Windows (WSL2)**. Native Windows isn't supported — Supabase CLI has known issues outside WSL2.

---

**Got a question before you start? Join the conversation on [GitHub Discussions](https://github.com/Coder-s-OG-s/MergeShip/discussions) - introductions, setup help, feature ideas, anything.**

## 1. Prerequisites

Install these once:

| Tool    | Version         | Notes                                                                                           |
| ------- | --------------- | ----------------------------------------------------------------------------------------------- |
| Node.js | 20 LTS or newer | Use [nvm](https://github.com/nvm-sh/nvm) or [nodejs.org](https://nodejs.org). Verify: `node -v` |
| npm     | 10+             | Comes with Node. Don't use pnpm or yarn — the lockfile is npm.                                  |
| Docker  | latest          | Docker Desktop on macOS/Windows, `docker.io` on Linux                                           |
| Git     | any modern      | `git --version`                                                                                 |

### Platform-specific setup

**macOS:**

- Install Docker Desktop from [docker.com](https://www.docker.com/products/docker-desktop). On Apple Silicon (M1/M2/M3) it runs native arm64 — no flags needed.
- Make sure Docker Desktop is **running** (icon in menu bar) before you start anything below.

**Windows:**

- Install [WSL2](https://learn.microsoft.com/en-us/windows/wsl/install) first (`wsl --install` in PowerShell, then reboot).
- Install Docker Desktop and enable the WSL2 backend in **Settings → General**.
- Run **all commands below from inside the WSL2 Ubuntu shell**, not PowerShell or CMD.
- Install Node + npm inside WSL2 (`sudo apt install nodejs npm` or use nvm inside WSL2).

**Linux:**

- Install Docker via your distro (`sudo apt install docker.io` on Ubuntu).
- Add yourself to the `docker` group so you don't need `sudo`: `sudo usermod -aG docker $USER`, then log out and back in.

### What you do NOT need

- A GitHub OAuth App
- A GitHub App
- A smee.io tunnel
- An Inngest, Groq, Sentry, or PostHog account
- A real Redis (in-memory fallback ships with the repo)

For 95% of contributor work, you only need the steps below.

---

## 2. Local setup (5 commands)

```bash
git clone https://github.com/Coder-s-OG-s/MergeShip.git
cd MergeShip
npm install
cp .env.example .env.local
```

Then start the local Supabase stack. **First run pulls ~2.5GB of Docker images and takes 5-10 minutes.** Subsequent starts are ~30 seconds.

```bash
make supabase-start
```

When it finishes, it prints URLs and keys. You need two keys from the output (or run `npx supabase status -o env` to print them again):

- `ANON_KEY` → paste into `.env.local` as `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- `SERVICE_ROLE_KEY` → paste into `.env.local` as `SUPABASE_SERVICE_ROLE_KEY`

Then apply migrations + seed dev personas:

```bash
make db-reset
```

Start the dev server:

```bash
npm run dev
```

App is live at **http://localhost:3001**.

---

## 3. Sign in

Open **http://localhost:3001/dev/login** and click any of the six seeded personas:

| Persona | Level      | What they have                            |
| ------- | ---------- | ----------------------------------------- |
| Alice   | L0         | Brand new account, no audit yet           |
| Bob     | L1         | Audited, has active recommendations       |
| Carol   | L2         | 3 merges, mentor-eligible                 |
| Dave    | L3         | Mentor with 5 mentees, sees `/maintainer` |
| Eve     | L4         | Senior mentor, sees `/maintainer`         |
| Frank   | Maintainer | Owns demo/sample-repo, sees `/maintainer` |

Click a button → instant sign-in via Supabase email/password (no real OAuth needed). The `/dev/login` page returns 404 in production builds.

---

## 4. Daily commands

```bash
make supabase-start    # start local Postgres/Auth (idempotent)
npm run dev            # dev server on :3001 with hot reload
make supabase-stop     # shut down containers when done

make db-reset          # nuke + re-apply migrations + reseed personas
make test              # run all tests
make test-watch        # TDD mode
make typecheck         # tsc --noEmit
make lint              # eslint
make format            # prettier --write
```

---

## 5. Repo layout

```
src/
  app/
    (app)/         # authenticated routes (dashboard, leaderboard, maintainer)
    [handle]/      # public profile pages /@username
    api/           # auth callback, github webhook, inngest endpoint
    actions/       # server actions, one file per domain
    dev/login/     # dev-only persona switcher
  lib/
    cache/         # redis or in-memory fallback
    db/            # drizzle schema + client
    github/        # octokit factories, webhook hmac
    help/          # help-routing logic
    llm/           # groq router
    maintainer/    # PR queue, issue triage, mentor flow
    pipeline/      # difficulty scoring, rec ranking
    supabase/      # supabase clients (browser / server / service-role)
    xp/            # curve, events, caps, audit, sources, streak
  inngest/
    client.ts
    functions/     # background jobs
supabase/
  migrations/      # numbered SQL migrations
scripts/
  seed.ts          # synthetic personas
  sim-webhook.ts   # fire mock webhook
```

Most contributor PRs only touch `src/app/`, `src/lib/`, or `src/app/actions/`.

---

## 6. Picking what to work on

1. Browse [issues labeled `good-first-issue`](https://github.com/Coder-s-OG-s/MergeShip/issues?q=is%3Aissue+is%3Aopen+label%3Agood-first-issue) or `gssoc`.
2. Comment "I'd like to work on this" before starting.
3. Wait for an assignment to avoid duplicate work.

---

## 7. PR workflow

```bash
# 1. Sync main
git checkout main
git pull origin main

# 2. Branch
git checkout -b feat/short-name        # also: fix/, chore/, docs/, refactor/

# 3. Make changes + tests, then verify
make test
make typecheck
make lint

# 4. Commit (one logical change per commit)
git add <specific files>               # not `git add .`
git commit                             # pre-commit hook runs prettier + eslint

# 5. Push + open PR
git push -u origin feat/short-name
```

Open the PR via the GitHub web UI or `gh pr create`.

PR title follows [conventional commits](https://www.conventionalcommits.org/): `feat(scope): ...`, `fix(scope): ...`, `chore: ...`, `test: ...`, `docs: ...`, `refactor: ...`.

PR body must include: what changed, why, test plan, and `Closes #N`.

---

## 8. By the type of change you're making

### A. UI tweak / new page

1. Find or create the file under `src/app/(app)/` or `src/components/`.
2. Edit and watch it hot-reload at localhost:3001.
3. Test with different personas via `/dev/login` to cover L0/L1/L2/maintainer states.
4. Tests not strictly required for UI but encouraged for logic.

### B. New server action

1. Add it to an existing `src/app/actions/<domain>.ts` or create a new file.
2. First line of the file: `'use server'`.
3. Auth-check at top: `const { data: { user } } = await sb.auth.getUser(); if (!user) return err(...)`.
4. Wrap with `rateLimit({ namespace: '...', key: user.id, limit, windowSec })`.
5. Return a `Result<T>` envelope: `ok(data)` or `err(code, message)`.
6. **Tests required.** Mock supabase, assert the result shape.

### C. Pure helper in `lib/`

1. Create `src/lib/<domain>/your-thing.ts` and a `.test.ts` alongside it.
2. **TDD**: write the failing test first.
3. Keep it pure — no I/O, no DB, no fetch.
4. Coverage gate: `lib/` must stay ≥80%.

### D. New XP rule

1. Add to `XP_REWARDS` and `XP_SOURCE` in `src/lib/xp/sources.ts`.
2. Add `refIds.yourThing(...)` so the idempotency key is unique.
3. Add a cap in `src/lib/xp/caps.ts` if it's user-actionable.
4. Fire the event from where the action happens.
5. Tests required for cap + idempotency.

### E. New Inngest function

1. Create `src/inngest/functions/your-function.ts`.
2. Wrap durable work in `step.run('name', async () => ...)`.
3. Use `concurrency: { key: 'event.data.<id>', limit: 1 }` to prevent races.
4. Register in `src/app/api/inngest/route.ts`.
5. To run locally, start the Inngest dev server in another terminal:
   ```bash
   npx inngest-cli@latest dev
   ```
   Functions auto-register from `/api/inngest`. UI at http://localhost:8288.

### F. DB migration

1. Create `supabase/migrations/000N_short_name.sql` (N = next number).
2. Use `if not exists` / `if exists` for safe reruns.
3. Mirror the columns/tables in `src/lib/db/schema.ts`.
4. RLS: every new table needs `enable row level security` + an explicit policy.
5. Run `make db-reset` to verify it applies cleanly.

### G. Webhook handler change

1. Edit the relevant file in `src/inngest/functions/process-*.ts`.
2. Test locally — see the next section.

### H. Bug fix

1. Reproduce locally first.
2. Write a failing test that captures the bug.
3. Fix the code, watch the test go green.

---

## 9. Testing webhook handlers

You do **not** need a real GitHub App. The repo includes a webhook simulator that signs and POSTs synthetic payloads:

```bash
npm run sim:webhook -- pr-merged --handle bob --repo demo/sample-repo --pr 123
npm run sim:webhook -- review --handle dave --pr-url https://github.com/demo/sample-repo/pull/123
npm run sim:webhook -- install --handle alice
```

The `--` is required to pass flags through npm.

Two outcomes:

- **Inngest dev server running** (`npx inngest-cli@latest dev`) → the function runs, you can verify DB state changed.
- **No Inngest dev server** → returns 202 with a log message. The webhook delivery row is still inserted; this is the right behavior for testing the route itself.

---

## 10. Code style — non-negotiable

- No `any` — use `unknown` + narrowing.
- No `console.log` in committed code.
- No emojis in code unless the user explicitly asked.
- Comments explain WHY, not WHAT.
- No `--no-verify` on commits — fix the lint issue instead.
- One PR = one logical change.
- File names: `kebab-case.ts`. Variables: `camelCase`. Types: `PascalCase`. SQL: `snake_case`.

The pre-commit hook runs prettier + eslint. If it blocks your commit, fix the issue and re-commit — never bypass.

---

## 11. Tests — required when

| Touching                 | Tests required?             |
| ------------------------ | --------------------------- |
| `src/lib/**`             | Yes                         |
| `src/app/actions/**`     | Yes                         |
| `src/inngest/**`         | Yes                         |
| `supabase/migrations/**` | Yes (RLS or trigger tests)  |
| `src/app/**` UI          | Encouraged, reviewer's call |

Coverage gate: `lib/` ≥ 80% lines. CI blocks merge if it drops.

---

## 12. Troubleshooting

**`supabase: command not found`**
Run via `make supabase-start` or `npx supabase ...`. Don't install supabase globally.

**`Cannot connect to the Docker daemon`**
Docker Desktop isn't running. Start it. On Linux: `sudo systemctl start docker`.

**`supabase start` hangs**
First run pulls ~2.5GB of images. Wait 5-10 min. Stuck after 15 min: `Ctrl-C`, run `npx supabase stop`, then retry.

**Supabase containers crash / out of memory**
Docker Desktop → Settings → Resources → bump Memory to at least 4GB.

**Port 54321 / 54322 / 54323 / 3001 already in use**
Another instance running. To free a port:

- macOS/Linux: `lsof -ti:3001 | xargs kill`
- Windows (WSL2): `lsof -ti:3001 | xargs -r kill`

Another supabase project running? `npx supabase stop` from its directory.

**`SUPABASE_SERVICE_ROLE_KEY required` when running seed**
You haven't pasted the `service_role` key into `.env.local`. Run `npx supabase status -o env` and copy `SERVICE_ROLE_KEY`'s value into `SUPABASE_SERVICE_ROLE_KEY=...` in `.env.local`.

**`/dev/login` returns 404**
You're in production mode. Use `npm run dev`, not `npm run build && npm start`.

**Persona button shows "Invalid credentials"**
The seed didn't run. `make db-seed`.

**"relation X already exists" on migration**
`make db-reset` wipes and reapplies cleanly.

**Tests fail with "fetch failed" to Supabase**
Local Supabase isn't running. `make supabase-start`.

**Prettier fails in CI but passes locally**
Run `make format` then commit. Usually a markdown file picked up formatter drift.

**`npm install` peer dependency errors**
Only use npm (not pnpm/yarn). `rm -rf node_modules package-lock.json && npm install`.

**`Cannot find module '@/lib/...'`**
VS Code: `Cmd/Ctrl+Shift+P` → "TypeScript: Select Version" → "Use Workspace Version".

**Hot reload not working**
Restart `npm run dev`. Usually a circular import.

**Cookie / session issues**
Use `http://localhost:3001`, not `127.0.0.1:3001`. Auth cookies are hostname-scoped.

**Windows: CRLF line ending warnings**

```bash
git config --global core.autocrlf input
```

**TypeScript error in a file you didn't touch**
Someone else's PR landed something that conflicts with your branch. Pull main and rebase.

---

## 13. Advanced — testing with a real GitHub App

Skip unless you need to debug actual webhook delivery from GitHub. Almost no PRs need this.

1. https://github.com/settings/apps/new
2. Name: globally unique (e.g. `mergeship-dev-yourname`)
3. Homepage URL: `http://localhost:3001`
4. Webhook URL: a smee.io channel (generate at smee.io)
5. Webhook secret: a random string, save it
6. Permissions: Pull requests R+W, Issues R+W, Metadata R, Pull request review R
7. Subscribe: Pull request, Pull request review, Issues, Issue comment, Installation, Installation repositories
8. Generate + download private key (`.pem`)
9. Install on a test repo you own
10. Fill `.env.local`:
    ```
    GITHUB_APP_ID=<id>
    GITHUB_APP_CLIENT_ID=<id>
    GITHUB_APP_CLIENT_SECRET=<secret>
    GITHUB_APP_PRIVATE_KEY="<full PEM as one quoted string>"
    GITHUB_WEBHOOK_SECRET=<your-random-string>
    MOCK_GITHUB_API=false
    MOCK_GITHUB_WEBHOOKS=false
    ```
11. Terminal A: `npx smee-client --url https://smee.io/<channel> --target http://localhost:3001/api/webhooks/github`
12. Terminal B: `npx inngest-cli@latest dev`
13. Trigger events on your test repo, watch them flow

---

## 14. Security

- Never commit `.env.local`, `.env`, `*.pem`, or any file with secrets.
- Never paste service role keys in issues or PRs.
- Never `git add .` blindly — stage specific files.
- Never bypass pre-commit hooks.

---

## 15. Getting help

1. Re-read the [Troubleshooting](#12-troubleshooting) section.
2. Search closed issues + PRs for your error.
3. Open a [GitHub Discussion](https://github.com/Coder-s-OG-s/MergeShip/discussions) with the `help-wanted` label.
4. GSSoC contributors: drop in the cohort Discord channel.
5. Tag the maintainer only after the above.

Include in any help request:

- OS + Node version (`node -v`)
- Exact command that failed
- Full error text (paste it, not a screenshot)
- What you already tried

---

## 16. License

By opening a PR you agree to license your contribution under the project's [MIT License](LICENSE). You retain copyright on your contribution.

We don't add AI-attribution footers to commits — author your work yourself.
