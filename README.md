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
* **Smart Placement:** Upon signing in, MergeShip analyzes your public GitHub profile and places you at the appropriate level (Level 0 to Level 2 maximum).
* **Foundational Course:** Level 0 contributors take a 5-day course covering Git basics, workflow, and open source etiquette before accessing codebases.
* **Hierarchical Peer Mentorship:** Level 2 contributors help Level 1, and Level 3 mentors Level 2, ensuring every PR is peer-reviewed.
* **Gamification:** Earn points and badges for merged PRs and mentorship to unlock higher-level, more complex issues.

### For Maintainers
* **Smart Dashboard:** A unified, sorted view of all organisation activity, eliminating the need to jump between multiple GitHub pages.
* **Pre-Verified PRs:** Pull Requests arrive with verification tags from mentors, allowing maintainers to focus on high-trust contributions.
* **Direct Communication:** Chat directly with contributors or schedule 1:1 meetings from within the platform.

## Tech Stack

MergeShip is built with a modern and scalable engineering stack:

* **Framework:** Next.js (App Router) & React
* **Database & Auth:** Supabase (Local Postgres + Auth Studio)
* **ORM:** Drizzle ORM
* **Background Jobs:** Inngest (Webhooks, Audits, PR processing)
* **AI / LLM:** Groq Router
* **Testing:** Vitest (Integration & Unit Testing)

## Architecture Overview

The codebase follows a domain-driven design structure:

* `src/app/` - Next.js routes (dashboards, public profiles, API callbacks).
* `src/components/` - Reusable UI components and shared layouts.
* `src/lib/` - Core business logic including:
  * `/db` - Drizzle schemas and database clients.
  * `/github` - Octokit factories and webhook verifiers.
  * `/pipeline` - Difficulty scoring and recommendation ranking.
  * `/xp` - Gamification system, event auditing, and caps.
* `inngest/` - Asynchronous background functions for heavy workloads.
* `supabase/` - SQL migrations and Docker configurations.
* `tests/` & `__fixtures__/` - High-coverage test suites and mock data.

## Quick Start (Local Setup)

The development environment is optimized to get you from clone to first PR in under 10 minutes.

### Prerequisites
* **Node.js**: v20 or higher
* **Docker**: Required for running the local Supabase instance
* **Package Manager**: npm

### Installation Steps

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Coder-s-OG-s/MergeShip.git](https://github.com/Coder-s-OG-s/MergeShip.git)
   cd MergeShip
   ```

2. **Install dependencies and set up environment:**
   ```bash
   npm install
   cp .env.example .env.local
   ```

3. **Start local Supabase and Seed Data:**
   ```bash
   make supabase-start    # Starts Postgres, Auth, and Studio via Docker
   make db-seed           # Seeds synthetic dev personas
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   Access the app at http://localhost:3001.

**Note on Authentication:** For local development, use the seeded personas at http://localhost:3001/dev/login for instant sign-in without configuring OAuth.

## Contributing

We maintain a high engineering bar with strict TypeScript, zero lint warnings, and 80%+ test coverage.

Please review our guidelines before contributing:
* [Contributing Guidelines](./CONTRIBUTING.md)
* [AI Usage Policy](./docs/ai-usage-policy.md)
* [Setup Guide](./docs/setup-guide.md)
* [Code of Conduct](./.github/CODE_OF_CONDUCT.md)

## License

This project is open-source and available under the [MIT License](LICENSE). Making open source better — for the people who build it.
