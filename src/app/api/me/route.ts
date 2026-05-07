import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/appwrite-server";
import { assembleProfile, findGithubIdentity, shouldBootstrap } from "@/lib/profile";
import type { ContributorProfile } from "@/types";

async function resolveProfile(
  sessionAccount: NonNullable<ReturnType<typeof getSessionAccount>>,
  options?: { allowGithubLookup?: boolean }
): Promise<ContributorProfile> {
  const user = await sessionAccount.get();
  const preferences = (user.prefs || {}) as Record<string, unknown>;
  const saved = preferences.contributor_profile as Partial<ContributorProfile> | undefined;

  let resolvedHandle: string | null = null;

  const identities = await sessionAccount.listIdentities().catch(() => ({ identities: [] }));
  const githubIdentity = findGithubIdentity(identities.identities as Parameters<typeof findGithubIdentity>[0]);

  if (githubIdentity && !saved?.github_handle && options?.allowGithubLookup) {
    try {
      const token = (githubIdentity as { providerAccessToken?: string }).providerAccessToken;
      if (!token) throw new Error("missing provider access token");
      const res = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });
      if (res.ok) {
        const ghUser = (await res.json()) as { login?: string };
        resolvedHandle = ghUser.login ?? null;
      }
    } catch (err) {
      console.error("[api/me] github handle lookup failed", err);
    }
  }

  return assembleProfile(
    {
      $id: user.$id,
      name: user.name,
      email: user.email,
      registration: user.registration,
      prefs: preferences,
    },
    githubIdentity,
    saved,
    resolvedHandle
  );
}

export async function GET() {
  try {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionAccount.get();
    const profile = await resolveProfile(sessionAccount, { allowGithubLookup: false });

    return NextResponse.json({
      user: { id: user.$id, name: user.name, email: user.email },
      profile,
    });
  } catch (error) {
    console.error("[api/me] GET failed", error);
    return NextResponse.json(
      { error: "Profile fetch failed due to a server configuration or upstream error." },
      { status: 500 }
    );
  }
}

export async function POST() {
  try {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionAccount.get();
    const preferences = (user.prefs || {}) as Record<string, unknown>;
    const saved = preferences.contributor_profile as Partial<ContributorProfile> | undefined;

    const needsUpdate = shouldBootstrap(saved);
    const profile = await resolveProfile(sessionAccount, {
      allowGithubLookup: needsUpdate && !saved?.github_handle,
    });

    if (needsUpdate) {
      await sessionAccount.updatePrefs({
        ...preferences,
        contributor_profile: { ...(saved || {}), ...profile },
      });
    }

    return NextResponse.json({ profile, bootstrapped: needsUpdate });
  } catch (error) {
    console.error("[api/me] POST bootstrap failed", error);
    return NextResponse.json(
      { error: "Profile bootstrap failed due to identity resolution or persistence error." },
      { status: 500 }
    );
  }
}
