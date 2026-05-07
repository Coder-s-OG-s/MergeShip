import type { ContributorProfile } from "@/types";

export interface GithubIdentity {
  provider: string;
  providerUid: string;
  providerAccessToken?: string;
}

export interface UserSnapshot {
  $id: string;
  name: string;
  email: string;
  registration: string;
  prefs: Record<string, unknown>;
}

/**
 * Parses a JWT token from an "Authorization: Bearer <token>" header value.
 * Returns null if the header is missing, malformed, or uses a non-bearer scheme.
 * Extracted as a pure function so it can be unit-tested without Next.js internals.
 */
export function parseJwtFromHeader(authorization: string | null): string | null {
  if (!authorization) return null;
  const spaceIdx = authorization.indexOf(" ");
  if (spaceIdx === -1) return null;
  const scheme = authorization.slice(0, spaceIdx);
  const token = authorization.slice(spaceIdx + 1).trim();
  if (scheme.toLowerCase() !== "bearer" || !token) return null;
  return token;
}

export function findGithubIdentity(identities: GithubIdentity[]): GithubIdentity | null {
  return identities.find((id) => id.provider.toLowerCase() === "github") ?? null;
}

/**
 * Assembles a ContributorProfile from Appwrite user data, identity, and any
 * previously-saved profile preferences. Always sets default_level to "L1".
 *
 * Priority order for each field:
 *   github_id    → identity providerUid → saved value → null
 *   github_handle → resolvedHandle param → saved value → null
 *   username     → saved value → user.name → generated fallback
 *   avatar_url   → saved value → CDN URL from github_id → ""
 *   joined_at    → saved value → user.registration ISO string
 */
export function assembleProfile(
  user: UserSnapshot,
  githubIdentity: GithubIdentity | null,
  saved: Partial<ContributorProfile> | undefined,
  resolvedHandle: string | null
): ContributorProfile {
  const githubId = githubIdentity?.providerUid ?? saved?.github_id ?? null;
  const githubHandle = resolvedHandle ?? saved?.github_handle ?? null;
  const username = saved?.username || user.name || `user-${user.$id.slice(0, 8)}`;
  const avatarUrl =
    saved?.avatar_url ||
    (githubId ? `https://avatars.githubusercontent.com/u/${githubId}` : "");

  return {
    github_id: githubId,
    github_handle: githubHandle,
    username,
    avatar_url: avatarUrl,
    joined_at: saved?.joined_at ?? new Date(user.registration).toISOString(),
    default_level: "L1",
  };
}

/**
 * Returns true when a saved profile is missing or incomplete enough that the
 * POST /api/me bootstrap step should run and persist updated values.
 */
export function shouldBootstrap(
  saved: Partial<ContributorProfile> | undefined
): boolean {
  return !saved || saved.default_level !== "L1" || !saved.joined_at || !saved.github_handle;
}
