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

Create `.env.local` with the following values:

```bash
NEXT_PUBLIC_APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
NEXT_PUBLIC_APPWRITE_PROJECT_ID=<your_appwrite_project_id>

APPWRITE_ENDPOINT=https://sgp.cloud.appwrite.io/v1
APPWRITE_PROJECT_ID=<your_appwrite_project_id>
APPWRITE_API_KEY=<your_appwrite_server_api_key>
```

## 🔐 GitHub OAuth Setup (Appwrite)

MergeShip uses GitHub OAuth via Appwrite for authentication. By default, OAuth is not enabled in a new Appwrite project, which can lead to runtime errors (e.g., `project_provider_disabled`). Follow the steps below to configure authentication correctly.

---

### 1. Enable GitHub OAuth Provider in Appwrite

1. Go to your Appwrite Console  
2. Navigate to **Auth → Settings → OAuth Providers**  
3. Locate **GitHub** and enable it  
4. You will be prompted to enter a **Client ID** and **Client Secret** (generated in the next step)

---

### 2. Create a GitHub OAuth App

Go to GitHub Developer Settings:

👉 https://github.com/settings/developers

1. Click **"New OAuth App"**
2. Fill in the following details:

- **Application Name**: `MergeShip Local`
- **Homepage URL**: http://localhost:3000
- **Authorization Callback URL**: The callback URL must match your configured Appwrite endpoint.

Use the following format:
<APPWRITE_ENDPOINT>/account/sessions/oauth2/callback/github/<YOUR_APPWRITE_PROJECT_ID>


> ⚠️ Important:
> - Do NOT hardcode the endpoint
> - Ensure it matches your `APPWRITE_ENDPOINT` in `.env.local`
> - This applies to both Appwrite Cloud (any region) and self-hosted instances

3. After creating the app, copy:
 - Client ID  
 - Client Secret  

4. Paste these into Appwrite under **GitHub OAuth Provider settings**

---

### 3. Add Web Platform in Appwrite

1. Go to **Appwrite Console → Settings → Platforms**
2. Click **Add Platform → Web App**
3. Configure:

- **Name**: `Localhost`
- **Hostname**: localhost

---

### 4. Restart Development Server

After completing the setup, restart your app:

```bash
npm run dev

### Common Errors

**Error 412: project_provider_disabled**
→ Enable GitHub provider in Appwrite Auth settings

**OAuth redirect not working**
→ Check callback URL includes correct project ID

**Unauthorized errors**
→ Verify API key permissions

## Auth/Profile API

- `GET /api/me`
  - Protected endpoint (requires active session JWT in `Authorization: Bearer <token>`)
  - Returns current user profile
- `POST /api/me`
  - Protected bootstrap endpoint for first-login profile initialization (JWT required)
  - Creates/normalizes contributor profile with:
    - `github_id`
    - `username`
    - `avatar_url`
    - `joined_at`
    - `default_level = L1`

### Project Structure

- `src/app`: Contains the Next.js application routes (App Router).
  - `(contributor)`: Routes specific to the contributor experience.
  - `(maintainer)`: Routes specific to the maintainer experience.
- `src/components`: Reusable React components.
- `src/data`: Mock data for development and testing.

## Contributing

We welcome contributions to improve MergeShip. Please review the project structure and ensure any changes align with the established design language and component architecture.
