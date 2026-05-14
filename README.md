<h1 align="center"> MergeShip</h1>

<p align="center">
  <strong>An open-source orchestration platform streamlining community-driven development.</strong>
</p>

<p align="center">
  <a href="#-about-the-project">About</a> •
  <a href="#-tech-stack">Tech Stack</a> •
  <a href="#-architecture">Architecture</a> •
  <a href="#-quick-start-local-setup">Quick Start</a> •
  <a href="#-contributing">Contributing</a>
</p>

---

## About The Project

**MergeShip** is a powerful platform designed to enhance the open-source ecosystem. It orchestrates contributions by evaluating PR events, scoring issue difficulties, and providing tailored recommendations to contributors. With a built-in XP system, AI-assisted routing, and robust background task processing, MergeShip makes open-source management seamless and engaging.

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

We welcome contributions! Please review our guidelines before starting:
* [Contributing Guidelines](./CONTRIBUTING.md) - Includes our local testing and PR flow.
* [AI Usage Policy](./docs/ai-usage-policy.md) - Rules for AI-assisted coding.
* [Code of Conduct](./.github/CODE_OF_CONDUCT.md) - Our community standards.

## 📄 License

This project is open-source and available under the [MIT License](LICENSE).
