# MergeShip

MergeShip is a platform designed to streamline the open source contribution and maintenance experience. It provides specialized dashboards for both contributors and maintainers to better manage repositories, triage issues, track pull requests, and foster community engagement.

## Features

### Contributor Dashboard

- **Discovery**: Find tailored issues to work on based on skill set and interests.
- **Workflow Tracking**: Manage active pull requests and engaged issues.
- **Community & Mentorship**: Connect with mentors and track personal achievements.
- **Leaderboards**: Engage in gamified community leaderboards based on contribution metrics.

### Maintainer Command Center

- **Overview**: High-level repository health, urgent issues, and pull request metrics.
- **Team Workload**: Real-time team capacity and automated reassignment recommendations.
- **Issue Triage**: AI-powered issue categorization and duplicate detection to maintain a clean backlog.
- **Analytics**: Deep-dive metrics into merge velocity, closure rates, and contributor retention.

## Getting Started

Follow these instructions to set up the project on your local machine for development and testing.

### Prerequisites

Ensure you have the following installed on your system:

- Node.js (v18 or higher recommended)
- npm (Node Package Manager)

### Installation

1. Clone the repository to your local machine:

```bash
git clone git@github.com:Coder-s-OG-s/MergeShip.git
cd MergeShip
```

1. Install the project dependencies:

```bash
npm install
```

1. Copy environment variables:

```bash
cp .env.example .env.local
```

### Running the Development Server

Start the local development server:

```bash
npm run dev
```

The application will be available at `http://localhost:3000`.

## Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_APPWRITE_ENDPOINT` | Appwrite API endpoint (e.g. `https://sgp.cloud.appwrite.io/v1`) |
| `NEXT_PUBLIC_APPWRITE_PROJECT_ID` | Project ID from Appwrite Console → Settings |
| `APPWRITE_ENDPOINT` | Same as above (server-side) |
| `APPWRITE_PROJECT_ID` | Same as above (server-side) |
| `APPWRITE_API_KEY` | Server API key from Appwrite Console → API Keys (required scopes: `account`, `sessions`) |
| `GROQ_API_KEY` | Groq API key for AI-generated learning paths (https://console.groq.com) |

## GitHub OAuth Setup

MergeShip delegates OAuth entirely to Appwrite — GitHub credentials are configured in the Appwrite Console and never stored in this application. OAuth state (CSRF protection) is handled automatically by Appwrite.

1. **Create a GitHub OAuth App**
   - Go to GitHub → Settings → Developer Settings → OAuth Apps → **New OAuth App**
   - Set **Authorization callback URL** to:
     ```
     https://<your-appwrite-endpoint>/v1/account/sessions/oauth2/callback/github/<your_project_id>
     ```
     For Appwrite Cloud: `https://sgp.cloud.appwrite.io/v1/account/sessions/oauth2/callback/github/<your_project_id>`
   - Copy the **Client ID** and **Client Secret**

2. **Enable GitHub OAuth in Appwrite**
   - Go to Appwrite Console → your project → **Auth** → **OAuth2 Providers**
   - Find **GitHub**, toggle it on, and paste the Client ID and Client Secret

3. **Configure allowed domains** (for production)
   - In Appwrite Console → your project → **Settings** → **Platforms**
   - Add your production domain as a Web platform

> **Minimum scope**: MergeShip requests only `read:user`. No OAuth secrets or access tokens are logged or persisted in the application.

## Auth/Profile API

- `GET /api/me`
  - Protected endpoint (requires active session JWT in `Authorization: Bearer <token>`)
  - Returns current user and contributor profile
  - Response: `{ user: { id, name, email }, profile: { github_id, github_handle, username, avatar_url, joined_at, default_level } }`
- `POST /api/me`
  - Bootstrap endpoint — call once after first login to initialize the contributor profile
  - Resolves GitHub identity, fetches handle, and persists profile with:
    - `github_id` — GitHub numeric user ID
    - `github_handle` — GitHub username (login)
    - `username` — display name
    - `avatar_url` — GitHub avatar CDN URL
    - `joined_at` — ISO 8601 timestamp of account creation
    - `default_level` — always `"L1"` for new contributors
  - Returns `{ profile, bootstrapped: boolean }` — `bootstrapped: true` means the profile was written for the first time

## Running Tests

```bash
npm test
```

### Project Structure

- `src/app`: Contains the Next.js application routes (App Router).
  - `(contributor)`: Routes specific to the contributor experience.
  - `(maintainer)`: Routes specific to the maintainer experience.
- `src/components`: Reusable React components.
- `src/data`: Mock data for development and testing.

## Contributing

We welcome contributions to improve MergeShip. Please review the project structure and ensure any changes align with the established design language and component architecture.
