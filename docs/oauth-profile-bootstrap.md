# OAuth Profile Bootstrap

This document describes the GitHub OAuth-based contributor profile bootstrap implemented in `src/app/api/me/route.ts`.

Overview
- The `GET /api/me` endpoint returns the current user session and a normalized `contributor_profile` object.
- The `POST /api/me` endpoint will attempt to bootstrap a contributor profile for first-time users by reading Appwrite account identities and, when available, resolving GitHub data (handle and avatar).

How it works
- The server reads the current session via `getSessionAccount()` (Appwrite server helper).
- If a GitHub identity is present in the account identities, the endpoint will use the provider access token to query `https://api.github.com/user` to fetch the GitHub login (handle) when needed.
- The profile stored in account preferences under `contributor_profile` contains:
  - `github_id`
  - `github_handle`
  - `username`
  - `avatar_url`
  - `joined_at`
  - `default_level` (defaults to `L1`)

Local testing
- Ensure you have a running Appwrite instance and a test project with OAuth configured for GitHub.
- Start the Next.js app in dev mode:

```bash
npm install
npm run dev
```

- Use an authenticated session (Appwrite) to call `/api/me` (GET/POST) from the browser or curl. The POST endpoint will bootstrap the profile when there is no existing `contributor_profile` in the user's preferences.

Notes for contributors
- This implementation expects Appwrite identities to provide a `providerAccessToken` for the GitHub identity to perform lookups. If the access token is missing, the endpoint will still return a profile using available account data.
- If you'd like to enhance the bootstrap (for example, fetch public repos or additional GitHub metadata), add the logic to `resolveProfile` in `src/app/api/me/route.ts` and include proper error handling for rate-limiting and missing tokens.
