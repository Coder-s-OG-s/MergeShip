import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/appwrite-server";
import { assembleProfile, findGithubIdentity, shouldBootstrap } from "@/lib/profile";
import type { ContributorProfile } from "@/types";

type UserSnapshot = {
  $id: string;
  name: string;
  email: string;
  registration: string;
  prefs: Record<string, unknown>;
};

export async function GET() {
  try {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionAccount.get();
    const preferences = (user.prefs || {}) as Record<string, unknown>;
    const saved = preferences.contributor_profile as Partial<ContributorProfile> | undefined;

    // listIdentities failure is a genuine server error — not silently ignored
    const identities = await sessionAccount.listIdentities();
    const githubIdentity = findGithubIdentity(
      identities.identities as Parameters<typeof findGithubIdentity>[0]
    );

    const snapshot: UserSnapshot = {
      $id: user.$id,
      name: user.name,
      email: user.email,
      registration: user.registration,
      prefs: preferences,
    };

    const profile = assembleProfile(snapshot, githubIdentity, saved, null);

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

    const snapshot: UserSnapshot = {
      $id: user.$id,
      name: user.name,
      email: user.email,
      registration: user.registration,
      prefs: preferences,
    };

    // Profile is already complete — return it without any side effects
    if (!shouldBootstrap(saved)) {
      const identities = await sessionAccount.listIdentities();
      const githubIdentity = findGithubIdentity(
        identities.identities as Parameters<typeof findGithubIdentity>[0]
      );
      const profile = assembleProfile(snapshot, githubIdentity, saved, null);
      return NextResponse.json({ profile, bootstrapped: false });
    }

    // Bootstrap required — resolve GitHub identity fully before persisting anything.
    // listIdentities failure is treated as a server error, not a silent empty list.
    const identities = await sessionAccount.listIdentities();
    const githubIdentity = findGithubIdentity(
      identities.identities as Parameters<typeof findGithubIdentity>[0]
    );

    // Resolve github_handle — required for a complete profile.
    // If the lookup fails for any reason, the entire request fails and nothing is persisted.
    let resolvedHandle: string | null = saved?.github_handle ?? null;

    if (!resolvedHandle && githubIdentity) {
      const token = (githubIdentity as { providerAccessToken?: string }).providerAccessToken;

      if (!token) {
        return NextResponse.json(
          { error: "GitHub access token unavailable. Re-authenticate to complete profile bootstrap." },
          { status: 422 }
        );
      }

      const ghRes = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `Bearer ${token}`,
          Accept: "application/vnd.github+json",
        },
      });

      if (!ghRes.ok) {
        return NextResponse.json(
          { error: "GitHub API unreachable. Retry to complete profile bootstrap." },
          { status: 502 }
        );
      }

      const ghUser = (await ghRes.json()) as { login?: string };
      resolvedHandle = ghUser.login ?? null;

      if (!resolvedHandle) {
        return NextResponse.json(
          { error: "GitHub login not returned. Retry to complete profile bootstrap." },
          { status: 502 }
        );
      }
    }

    // Assemble the complete profile — only then persist
    const profile = assembleProfile(snapshot, githubIdentity, saved, resolvedHandle);

    await sessionAccount.updatePrefs({
      ...preferences,
      contributor_profile: { ...(saved || {}), ...profile },
    });

    return NextResponse.json({ profile, bootstrapped: true });
  } catch (error) {
    console.error("[api/me] POST bootstrap failed", error);
    return NextResponse.json(
      { error: "Profile bootstrap failed due to identity resolution or persistence error." },
      { status: 500 }
    );
  }
}
