# Contributing to MergeShip

Welcome. This guide gets you from `git clone` to a running local app, then walks you through opening your first PR. Should take 15-20 minutes the first time.

Works the same on **macOS**, **Linux**, and **Windows (WSL2)**. Native Windows isn't supported — Supabase CLI has known issues outside WSL2.

---

## 1. Prerequisites

Install these once before starting:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20 LTS or newer | Use nvm or nodejs.org. Verify: `node -v` |
| pnpm | latest | Package manager required for this project. Install via `npm install -g pnpm` |
| Docker | latest | Docker Desktop on macOS/Windows, `docker.io` on Linux |
| Supabase CLI | latest | Used for local database and auth testing |
| Git | any modern | Verify: `git --version` |

### Platform-specific setup

**macOS:**
- Install Docker Desktop. On Apple Silicon (M1/M2/M3) it runs native arm64.
- Make sure Docker Desktop is **running** before you start.

**Windows:**
- Install WSL2 (`wsl --install` in PowerShell, then reboot).
- Install Docker Desktop and enable the WSL2 backend in Settings → General.
- Run **all commands below from inside the WSL2 Ubuntu shell**.

---

## 2. Local setup (Step-by-step)

```bash
git clone [https://github.com/Coder-s-OG-s/MergeShip.git](https://github.com/Coder-s-OG-s/MergeShip.git)
cd MergeShip
pnpm install
cp .env.example .env.local

Then start the local Supabase stack. First run pulls ~2.5GB of Docker images and takes 5-10 minutes.
make supabase-start

Apply migrations + seed dev personas:
make db-reset

Start the dev server:
pnpm dev

App is live at http://localhost:3001.

Koi baat nahi Yukti, hota hai! Panic mein aksar Cmd + A aur Delete dab hi jata hai. 😂

Main niche poora final code wapas de raha hoon. Is baar ekdum dhyan se copy karna (code block ke top-right corner mein Copy icon use karna) aur use apni CONTRIBUTING.md mein paste karke save kar do.

Markdown
# Contributing to MergeShip

Welcome. This guide gets you from `git clone` to a running local app, then walks you through opening your first PR. Should take 15-20 minutes the first time.

Works the same on **macOS**, **Linux**, and **Windows (WSL2)**. Native Windows isn't supported — Supabase CLI has known issues outside WSL2.

---

## 1. Prerequisites

Install these once before starting:

| Tool | Version | Notes |
| --- | --- | --- |
| Node.js | 20 LTS or newer | Use nvm or nodejs.org. Verify: `node -v` |
| pnpm | latest | Package manager required for this project. Install via `npm install -g pnpm` |
| Docker | latest | Docker Desktop on macOS/Windows, `docker.io` on Linux |
| Supabase CLI | latest | Used for local database and auth testing |
| Git | any modern | Verify: `git --version` |

### Platform-specific setup

**macOS:**
- Install Docker Desktop. On Apple Silicon (M1/M2/M3) it runs native arm64.
- Make sure Docker Desktop is **running** before you start.

**Windows:**
- Install WSL2 (`wsl --install` in PowerShell, then reboot).
- Install Docker Desktop and enable the WSL2 backend in Settings → General.
- Run **all commands below from inside the WSL2 Ubuntu shell**.

---

## 2. Local setup (Step-by-step)

```bash
git clone [https://github.com/Coder-s-OG-s/MergeShip.git](https://github.com/Coder-s-OG-s/MergeShip.git)
cd MergeShip
pnpm install
cp .env.example .env.local
Then start the local Supabase stack. First run pulls ~2.5GB of Docker images and takes 5-10 minutes.

Bash
make supabase-start
Apply migrations + seed dev personas:

Bash
make db-reset
Start the dev server:

Bash
pnpm dev
App is live at http://localhost:3001.

3. Environment Variables Explanation (.env.example)
Your .env.local file requires specific keys to function properly. Here is what each variable does and where to get it:

NEXT_PUBLIC_SUPABASE_ANON_KEY: Public key for Supabase client. You get this from the terminal output after running make supabase-start or by running npx supabase status -o env.

SUPABASE_SERVICE_ROLE_KEY: Admin key for server-side Supabase operations. Found in the same terminal output mentioned above.

GITHUB_APP_ID, GITHUB_APP_CLIENT_ID, GITHUB_APP_CLIENT_SECRET, GITHUB_APP_PRIVATE_KEY: Required for GitHub webhook integration. You generate these by creating a GitHub App in your developer settings (See Section 12).

GITHUB_WEBHOOK_SECRET: A custom random string you set when configuring your GitHub App webhooks.

4. Sign in
Open http://localhost:3001/dev/login and click any seeded persona (Alice, Bob, etc.) for instant sign-in. The /dev/login page returns 404 in production builds.

5. Daily commands

make supabase-start    # start local Postgres/Auth
pnpm dev               # dev server on :3001 with hot reload
make supabase-stop     # shut down containers

make db-reset          # nuke + re-apply migrations + reseed personas
make test              # run all tests
make typecheck         # tsc --noEmit
make lint              # eslint
make format            # prettier --write

6. PR workflow & Guidelines

# 1. Sync main
git checkout main
git pull origin main

# 2. Branch naming conventions
# Use descriptive prefixes: fix/issue-name or feat/feature-name
git checkout -b feat/short-name        

# 3. Verify changes
make test
make typecheck
make lint

# 4. Commit format
# Use conventional commits: fix: description or feat: description
git add <specific files>               
git commit                             

# 5. Push + open PR
git push -u origin feat/short-name

PR title must follow conventional commits. PR body must include: what changed, why, and Closes #N.

7. Code style — non-negotiable
Tailwind Only: Strictly use Tailwind classes for styling. No custom CSS.

No emojis: Do not use emojis in the codebase or commit messages.

Minimal comments: Write self-documenting code. No comments unless absolutely necessary for complex logic.

No any — use unknown + narrowing.

No console.log in committed code.

File names: kebab-case.ts. Variables: camelCase. Types: PascalCase. SQL: snake_case.


8. By the type of change you're making
A. UI tweak / new page
Find or create the file under src/app/(app)/ or src/components/. Test with different personas via /dev/login.

B. New server action
First line: 'use server'. Return a Result<T> envelope. Tests required.

C. Pure helper in lib/
Keep it pure — no I/O, no DB, no fetch. Coverage gate: lib/ must stay ≥80%.

D. DB migration
Create supabase/migrations/000N_short_name.sql. Run make db-reset to verify.

9. Testing webhook handlers
The repo includes a webhook simulator that signs and POSTs synthetic payloads:

npm run sim:webhook -- pr-merged --handle bob --repo demo/sample-repo --pr 123

10. Tests — required when

Touching,Tests required?
src/lib/**,Yes
src/app/actions/**,Yes
src/inngest/**,Yes
supabase/migrations/**,Yes (RLS or trigger tests)

11. Troubleshooting
supabase: command not found: Run via make supabase-start.

Cannot connect to the Docker daemon: Start Docker Desktop.

Port already in use: Kill the process using port 3001 or 54321.

/dev/login returns 404: Ensure you are using pnpm dev.

12. GitHub App setup instructions (Webhook integration)
If you need to test actual webhook delivery:

Go to GitHub Developer Settings -> GitHub Apps -> New GitHub App.

Homepage URL: http://localhost:3001

Webhook URL: Use a tunneling service like smee.io.

Webhook secret: Create a random string.

Generate and download the private key (.pem).

Update .env.local with the generated App ID, Client ID, Client Secret, Webhook Secret, and the exact contents of the PEM file.


