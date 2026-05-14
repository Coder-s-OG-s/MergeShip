<h1 align="center">🚢 MergeShip</h1>

<p align="center">
  [cite_start]<strong>An Open Source Ecosystem and Organisation Management Platform [cite: 1]</strong>
</p>

<p align="center">
  [cite_start]Helping contributors learn the right way and helping maintainers stay sane. [cite: 1]
</p>

<p align="center">
  <a href="#about-the-project">About</a> •
  <a href="#core-features">Features</a> •
  <a href="#tech-stack">Tech Stack</a> •
  <a href="#architecture-overview">Architecture</a> •
  <a href="#quick-start-local-setup">Quick Start</a> •
  <a href="#contributing">Contributing</a>
</p>

---

## About The Project

[cite_start]MergeShip is an open source platform that works for two groups at the same time — contributors who want to get into open source, and maintainers who are managing open source organisations. [cite: 3] 

Open source today is broken. [cite_start]Contributors often lack basic Git/GitHub knowledge and don't have a structured path[cite: 10, 12]. [cite_start]On the flip side, maintainers are overwhelmed by low-quality AI-generated PRs and scattered organisational data[cite: 16, 17]. [cite_start]MergeShip solves both problems together — through gamified learning for contributors, and a smart organised dashboard for maintainers. [cite: 7]

## Core Features

### For Contributors
* [cite_start]**Smart Placement:** When you sign in, MergeShip analyzes your public GitHub profile and places you at the appropriate level (Level 0 to Level 2 max)[cite: 25, 28].
* [cite_start]**Foundational Course:** Complete beginners (Level 0) take a 5-day course covering Git basics, workflow, and etiquette before touching code[cite: 27, 30, 32].
* [cite_start]**Hierarchical Peer Mentorship:** Level 2 contributors mentor Level 1, and Level 3 mentors Level 2[cite: 44, 45].
* [cite_start]**Gamification:** Earn points and badges for merged PRs and successful mentoring to unlock harder issues[cite: 50, 51, 52].

### For Maintainers
* [cite_start]**Smart Dashboard:** A clean, sorted view of everything happening in the org, eliminating scattered data[cite: 64, 65].
* [cite_start]**Pre-Verified PRs:** PRs arrive with tags like "Reviewed by L2 Mentor", allowing maintainers to review high-trust code faster[cite: 46, 69].
* [cite_start]**Direct Communication:** Chat or schedule 1:1 meetings directly with contributors from the dashboard[cite: 71].

## Tech Stack

MergeShip is built with a highly scalable, modern engineering stack:

* **Framework:** Next.js (App Router) & React
* **Database & Auth:** Supabase (Local Postgres + Auth Studio)
* **ORM:** Drizzle ORM
* **Background Jobs:** Inngest (Webhooks, Audits, PR processing)
* **AI / LLM:** Groq Router
* **Testing:** Vitest (Integration & Unit Testing)

## Architecture Overview

Our codebase follows a strict, domain-driven design structure:

* `src/app/` - Next.js routes (authenticated dashboards, public profiles, API callbacks).
* `src/components/` - Reusable UI components and shared layouts.
* `src/lib/` - Core business logic:
  * `/db` - Drizzle schemas and database clients.
  * `/github` - Octokit factories and HMAC webhook verifiers.
  * `/pipeline` - Difficulty scoring and recommendation ranking.
  * `/xp` - Gamification system, event auditing, and caps.
* `inngest/` - Asynchronous background functions for processing heavy workloads.
* `supabase/` - SQL migrations and Docker configurations.
* `tests/` & `__fixtures__/` - High-coverage test suites and mock data.

## Quick Start (Local Setup)

We've optimized our DevEx so you can go from `git clone` to your first PR in under 10 minutes.

### Prerequisites
* **Node.js**: v20+
* **Docker**: Required for running the local Supabase instance.
* **Package Manager**: npm

### Installation & Bootstrapping

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/Coder-s-OG-s/MergeShip.git](https://github.com/Coder-s-OG-s/MergeShip.git)
   cd MergeShip
   ```

2. **Install dependencies & set up environments:**
   ```bash
   npm install
   cp .env.example .env.local
   ```

3. **Start the local Supabase & Seed Database:**
   ```bash
   make supabase-start    # Starts local Postgres + Auth + Studio in Docker
   make db-seed           # Seeds synthetic dev personas
   ```

4. **Run the development server:**
   ```bash
   npm run dev
   ```
   *Open [http://localhost:3001](http://localhost:3001) in your browser.*

> **Dev Authentication:** To save you from configuring a personal GitHub OAuth App for local work, we use seeded Dev Personas (Alice, Bob, Carol, etc.). Simply go to `http://localhost:3001/dev/login` for instant sign-in.

## Contributing

We maintain a strict engineering bar (100% strict TypeScript, 0 lint warnings, 80%+ coverage) to keep the codebase healthy. 

As a project proudly listed on **Code for GovTech (C4GT)**, we welcome contributions! Please review our guidelines before starting:
* [Contributing Guidelines](./CONTRIBUTING.md) - Includes our local testing and PR flow.
* [AI Usage Policy](./docs/ai-usage-policy.md) - Rules for AI-assisted coding.
* [Setup Guide](./docs/setup-guide.md) - Detailed backend and OAuth setup.
* [Code of Conduct](./.github/CODE_OF_CONDUCT.md) - Our community standards.

## License

This project is open-source and available under the [MIT License](LICENSE). [cite_start]Making open source better — for the people who build it. [cite: 90]
