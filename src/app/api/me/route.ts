import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/appwrite-server";

type ContributorProfile = {
  github_id: string | null;
  github_handle: string | null;
  username: string;
  avatar_url: string;
  joined_at: string;
  default_level: "L1";
};

async function resolveProfile(
  sessionAccount: NonNullable<ReturnType<typeof getSessionAccount>>,
  options?: { allowGithubLookup?: boolean }
): Promise<ContributorProfile> {
  const user = await sessionAccount.get();
  const preferences = (user.prefs || {}) as Record<string, unknown>;
  const existingProfile = preferences.contributor_profile as
    | Partial<ContributorProfile>
    | undefined;

  let githubId: string | null = existingProfile?.github_id || null;
  let githubHandle: string | null = existingProfile?.github_handle || null;
  const fallbackUsername =
    user.name || `user-${user.$id.slice(0, 8)}`;
  let username = existingProfile?.username || fallbackUsername;
  let avatarUrl = existingProfile?.avatar_url || "";

  try {
    const identities = await sessionAccount.listIdentities();
    const githubIdentity = identities.identities.find(
      (identity) => identity.provider.toLowerCase() === "github"
    );
    if (githubIdentity) {
      githubId = githubIdentity.providerUid;
      if (!githubHandle && options?.allowGithubLookup) {
        try {
          const githubToken = (githubIdentity as { providerAccessToken?: string })
            .providerAccessToken;
          if (!githubToken) {
            throw new Error("Missing provider access token");
          }
          const githubUserResponse = await fetch("https://api.github.com/user", {
            headers: {
              Authorization: `Bearer ${githubToken}`,
              Accept: "application/vnd.github+json",
            },
          });
          if (githubUserResponse.ok) {
            const githubUser = (await githubUserResponse.json()) as { login?: string };
            githubHandle = githubUser.login || githubHandle;
          }
        } catch (githubLookupError) {
          console.error("[api/me] github handle lookup failed", githubLookupError);
        }
      }
      if (!avatarUrl && githubId) {
        avatarUrl = `https://avatars.githubusercontent.com/u/${githubId}`;
      }
    }
  } catch (error) {
    console.error("[api/me] identity lookup failed", error);
  }

  return {
    github_id: githubId,
    github_handle: githubHandle,
    username,
    avatar_url: avatarUrl,
    joined_at: existingProfile?.joined_at || new Date(user.registration).toISOString(),
    default_level: "L1",
  };
}

export async function GET() {
  try {
    const sessionAccount = getSessionAccount();
    if (!sessionAccount) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const user = await sessionAccount.get();
    const contributorProfile = await resolveProfile(sessionAccount, {
      allowGithubLookup: false,
    });

    return NextResponse.json({
      user: {
        id: user.$id,
        name: user.name,
        email: user.email,
      },
      profile: contributorProfile,
    });
  } catch (error) {
    console.error("[api/me] failed to fetch profile", error);
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
    const existingProfile = preferences.contributor_profile as
      | Partial<ContributorProfile>
      | undefined;

    const contributorProfile = await resolveProfile(sessionAccount, {
      allowGithubLookup: true,
    });
    const needsBootstrap =
      !existingProfile ||
      existingProfile.default_level !== "L1" ||
      !existingProfile.joined_at;

    if (needsBootstrap) {
      const mergedProfile = {
        ...(existingProfile || {}),
        ...contributorProfile,
      };
      await sessionAccount.updatePrefs({
        ...preferences,
        contributor_profile: mergedProfile,
      });
    }

    return NextResponse.json({
      profile: contributorProfile,
      bootstrapped: needsBootstrap,
    });
  } catch (error) {
    console.error("[api/me] failed to bootstrap profile", error);
    return NextResponse.json(
      { error: "Profile bootstrap failed due to identity resolution or persistence error." },
      { status: 500 }
    );
  }
}
