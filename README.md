# MergeShip

An Open Source Ecosystem and Organisation Management Platform

Helping contributors learn the right way and helping maintainers stay sane.

[About](#about-the-project) • [Features](#core-features) • [Tech Stack](#tech-stack) • [Architecture](#architecture-overview) • [Quick Start](#quick-start-local-setup) • [Contributing](#contributing)

---

## About The Project

MergeShip is an open source platform that works for two groups at the same time — contributors who want to get into open source, and maintainers who are managing open source organisations.

Open source today faces two major hurdles: contributors often lack a structured path and basic Git/GitHub knowledge, while maintainers are overwhelmed by low-quality AI-generated PRs and scattered data. MergeShip solves both problems together through gamified learning for contributors and a smart organised dashboard for maintainers.

## Core Features

### For Contributors

- **Smart Placement:** Upon signing in, MergeShip analyzes your public GitHub profile and places you at the appropriate level (Level 0 to Level 2 maximum).
- **Foundational Course:** Level 0 contributors take a 5-day course covering Git basics, workflow, and open source etiquette before accessing codebases.
- **Hierarchical Peer Mentorship:** Level 2 contributors help Level 1, and Level 3 mentors Level 2, ensuring every PR is peer-reviewed.
- **Gamification:** Earn points and badges for merged PRs and mentorship to unlock higher-level, more complex issues.

### For Maintainers

- **Smart Dashboard:** A unified, sorted view of all organisation activity, eliminating the need to jump between multiple GitHub pages.
- **Pre-Verified PRs:** Pull Requests arrive with verification tags from mentors, allowing maintainers to focus on high-trust contributions.
- **Direct Communication:** Chat directly with contributors or schedule 1:1 meetings from within the platform.

## Tech Stack

MergeShip is built with a modern and scalable engineering stack:

- **Framework:** Next.js (App Router) & React
- **Database & Auth:** Supabase (Local Postgres + Auth Studio)
- **ORM:** Drizzle ORM
- **Background Jobs:** Inngest (Webhooks, Audits, PR processing)
- **AI / LLM:** Groq Router
- **Testing:** Vitest (Integration & Unit Testing)

## Architecture Overview

The codebase follows a domain-driven design structure:

- `src/app/` - Next.js routes (dashboards, public profiles, API callbacks).
- `src/components/` - Reusable UI components and shared layouts.
- `src/lib/` - Core business logic including:
  - `/db` - Drizzle schemas and database clients.
  - `/github` - Octokit factories and webhook verifiers.
  - `/pipeline` - Difficulty scoring and recommendation ranking.
  - `/xp` - Gamification system, event auditing, and caps.
- `inngest/` - Asynchronous background functions for heavy workloads.
- `supabase/` - SQL migrations and Docker configurations.
- `tests/` & `__fixtures__/` - High-coverage test suites and mock data.

## Quick Start

Works on macOS, Linux, and Windows (WSL2). Full step-by-step in [CONTRIBUTING.md](./CONTRIBUTING.md).

```bash
git clone https://github.com/Coder-s-OG-s/MergeShip.git
cd MergeShip
npm install
cp .env.example .env.local
make supabase-start        # boots local Postgres + Auth in Docker
# paste ANON_KEY and SERVICE_ROLE_KEY from the output into .env.local
make db-reset              # migrations + seeded personas
npm run dev                # http://localhost:3001
```

Open `http://localhost:3001/dev/login` and click any persona to sign in. No GitHub OAuth or external accounts required for local work.

For prerequisites, troubleshooting, and the full contributor workflow, read [CONTRIBUTING.md](./CONTRIBUTING.md).

## Contributing

We maintain a high engineering bar: strict TypeScript, zero lint warnings, and 80%+ test coverage on `lib/`.

- [Contributing Guidelines](./CONTRIBUTING.md) — local setup, PR workflow, code style
- [Deployment Guide](./docs/deployment.md) — production setup (Vercel + real Supabase + GitHub App)
- [AI Usage Policy](./docs/ai-usage-policy.md)
- [Code of Conduct](./CODE_OF_CONDUCT.md)

## License

This project is open-source and available under the [MIT License](LICENSE). Making open source better — for the people who build it.
