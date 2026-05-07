import {
  parseJwtFromHeader,
  findGithubIdentity,
  assembleProfile,
  shouldBootstrap,
} from "@/lib/profile";

describe("parseJwtFromHeader", () => {
  it("returns null for null input", () => {
    expect(parseJwtFromHeader(null)).toBeNull();
  });

  it("returns null when header has no space", () => {
    expect(parseJwtFromHeader("noschemetoken")).toBeNull();
  });

  it("returns null for non-bearer scheme", () => {
    expect(parseJwtFromHeader("Basic abc123")).toBeNull();
  });

  it("returns null when token is empty after scheme", () => {
    expect(parseJwtFromHeader("Bearer ")).toBeNull();
  });

  it("extracts token from a valid Bearer header", () => {
    expect(parseJwtFromHeader("Bearer my.jwt.token")).toBe("my.jwt.token");
  });

  it("is case-insensitive for the Bearer scheme", () => {
    expect(parseJwtFromHeader("BEARER token123")).toBe("token123");
    expect(parseJwtFromHeader("bearer token123")).toBe("token123");
  });
});

describe("findGithubIdentity", () => {
  it("returns null for an empty identity list", () => {
    expect(findGithubIdentity([])).toBeNull();
  });

  it("finds a github identity (case-insensitive)", () => {
    const identities = [
      { provider: "Google", providerUid: "g1" },
      { provider: "GitHub", providerUid: "gh1" },
    ];
    const result = findGithubIdentity(identities);
    expect(result?.providerUid).toBe("gh1");
  });

  it("returns null when only non-github providers are present", () => {
    const identities = [{ provider: "google", providerUid: "g1" }];
    expect(findGithubIdentity(identities)).toBeNull();
  });
});

describe("assembleProfile", () => {
  const baseUser = {
    $id: "uid001234",
    name: "Test User",
    email: "test@example.com",
    registration: "2024-01-15T10:00:00.000Z",
    prefs: {},
  };

  const githubIdentity = { provider: "github", providerUid: "7654321" };

  it("builds a valid L1 profile from a fresh GitHub identity with no saved data", () => {
    const profile = assembleProfile(baseUser, githubIdentity, undefined, null);

    expect(profile.default_level).toBe("L1");
    expect(profile.github_id).toBe("7654321");
    expect(profile.avatar_url).toBe("https://avatars.githubusercontent.com/u/7654321");
    expect(profile.joined_at).toBe("2024-01-15T10:00:00.000Z");
    expect(profile.username).toBe("Test User");
    expect(profile.github_handle).toBeNull();
  });

  it("applies a resolved github handle from the caller", () => {
    const profile = assembleProfile(baseUser, githubIdentity, undefined, "testhandle");
    expect(profile.github_handle).toBe("testhandle");
  });

  it("preserves saved profile data on a subsequent login (idempotent)", () => {
    const saved = {
      github_id: "7654321",
      github_handle: "testhandle",
      username: "testhandle",
      avatar_url: "https://avatars.githubusercontent.com/u/7654321",
      joined_at: "2024-01-15T10:00:00.000Z",
      default_level: "L1" as const,
    };
    const profile = assembleProfile(baseUser, githubIdentity, saved, null);

    expect(profile.github_handle).toBe("testhandle");
    expect(profile.username).toBe("testhandle");
    expect(profile.joined_at).toBe("2024-01-15T10:00:00.000Z");
    expect(profile.default_level).toBe("L1");
  });

  it("always sets default_level to L1 regardless of saved data", () => {
    const profile = assembleProfile(baseUser, null, undefined, null);
    expect(profile.default_level).toBe("L1");
  });

  it("generates a fallback username from user.$id when name is empty", () => {
    const userNoName = { ...baseUser, name: "" };
    const profile = assembleProfile(userNoName, null, undefined, null);
    // $id "uid001234" → slice(0, 8) → "uid00123"
    expect(profile.username).toBe("user-uid00123");
  });

  it("leaves avatar_url empty when there is no github_id and no saved url", () => {
    const profile = assembleProfile(baseUser, null, undefined, null);
    expect(profile.avatar_url).toBe("");
    expect(profile.github_id).toBeNull();
  });

  it("resolvedHandle takes priority over saved github_handle", () => {
    const saved = { github_handle: "old_handle", default_level: "L1" as const, joined_at: "2024-01-15T10:00:00.000Z" };
    const profile = assembleProfile(baseUser, githubIdentity, saved, "new_handle");
    expect(profile.github_handle).toBe("new_handle");
  });
});

describe("shouldBootstrap", () => {
  it("returns true when saved profile is undefined", () => {
    expect(shouldBootstrap(undefined)).toBe(true);
  });

  it("returns true when default_level is missing", () => {
    expect(shouldBootstrap({ joined_at: "2024-01-15", github_handle: "user" })).toBe(true);
  });

  it("returns true when joined_at is missing", () => {
    expect(shouldBootstrap({ default_level: "L1", github_handle: "user" })).toBe(true);
  });

  it("returns true when github_handle is missing", () => {
    expect(shouldBootstrap({ default_level: "L1", joined_at: "2024-01-15" })).toBe(true);
  });

  it("returns false when all required fields are present", () => {
    expect(
      shouldBootstrap({ default_level: "L1", joined_at: "2024-01-15", github_handle: "user" })
    ).toBe(false);
  });
});
