import { NextResponse } from "next/server";
import { getSessionAccount } from "@/lib/appwrite-server";

type ContributorProfile = {
  github_id: string | null;
  username: string;
  avatar_url: string;
  joined_at: string;
  default_level: "L1";
};

export async function GET() {
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

    let githubId: string | null = existingProfile?.github_id || null;
    let username =
      existingProfile?.username || user.name || user.email.split("@")[0];
    let avatarUrl = existingProfile?.avatar_url || "";

    try {
      const identities = await sessionAccount.listIdentities();
      const githubIdentity = identities.identities.find(
        (identity) => identity.provider.toLowerCase() === "github"
      );
      if (githubIdentity) {
        githubId = githubIdentity.providerUid;
        if (!existingProfile?.username) {
          username = githubIdentity.providerEmail?.split("@")[0] || username;
        }
        if (!avatarUrl && githubId) {
          avatarUrl = `https://avatars.githubusercontent.com/u/${githubId}`;
        }
      }
    } catch {
      // identity listing may fail for some providers; profile bootstrap should still proceed
    }

    const contributorProfile: ContributorProfile = {
      github_id: githubId,
      username,
      avatar_url: avatarUrl,
      joined_at: existingProfile?.joined_at || new Date().toISOString(),
      default_level: "L1",
    };

    const needsBootstrap =
      !existingProfile ||
      existingProfile.default_level !== "L1" ||
      !existingProfile.joined_at;

    if (needsBootstrap) {
      await sessionAccount.updatePrefs({
        ...preferences,
        contributor_profile: contributorProfile,
      });
    }

    return NextResponse.json({
      user: {
        id: user.$id,
        name: user.name,
        email: user.email,
      },
      profile: contributorProfile,
    });
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
}
