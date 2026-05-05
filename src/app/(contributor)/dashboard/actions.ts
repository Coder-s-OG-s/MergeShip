"use server";

const CACHE_TTL = 1000 * 60 * 60;

// NOTE:
// In-memory cache is instance-local and not suitable for serverless scale.
// Replace with Redis or persistent store in production.
const statsCache = new Map<string, { statsJson: string; lastSync: number }>();

async function safeGithubFetch(url: string, token?: string) {
    if (!url.startsWith("https://api.github.com/")) return null;

    try {
        const res = await fetch(url, {
            headers: token ? { Authorization: `Bearer ${token}` } : {}
        });

        if (res.status === 403) {
            console.warn("[MergeShip] GitHub rate limit hit");
        }

        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error("[MergeShip] GitHub fetch error:", e);
        return null;
    }
}

async function safeExternalFetch(url: string) {
    try {
        const res = await fetch(url);
        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error("[MergeShip] External fetch error:", e);
        return null;
    }
}

async function resolveGithubIdentity(token?: string, fallbackHandle?: string) {
    if (!token) return fallbackHandle?.toLowerCase();

    const me = await safeGithubFetch("https://api.github.com/user", token);
    return me?.login?.toLowerCase() || fallbackHandle?.toLowerCase();
}

async function getCached(key: string) {
    return statsCache.get(key) || null;
}

async function setCached(key: string, data: any) {
    statsCache.set(key, {
        statsJson: JSON.stringify(data),
        lastSync: Date.now()
    });
}

function fallbackStats() {
    return {
        level: "L1 Beginner",
        levelCode: "L1",
        levelTitle: "Beginner",
        progress: 0,
        totalXP: 0,
        displayXP: 0,
        streak: 0,
        activeDays: 0,
        repos: 0,
        followers: 0,
        contributions: 0,
        claimedBadges: []
    };
}

export async function getDashboardData(
    githubHandle: string,
    token?: string,
    forceSync = false
) {
    const resolvedHandle = await resolveGithubIdentity(token, githubHandle);
    if (!resolvedHandle) {
        return { success: true, stats: fallbackStats(), fallback: true };
    }

    const key = resolvedHandle;

    if (!forceSync) {
        const cached = await getCached(key);
        if (cached && Date.now() - cached.lastSync < CACHE_TTL) {
            return { success: true, stats: JSON.parse(cached.statsJson), fromCache: true };
        }
    }

    try {
        const [userData, events, heatmap] = await Promise.all([
            safeGithubFetch(`https://api.github.com/users/${key}`, token),
            safeGithubFetch(`https://api.github.com/users/${key}/events/public?per_page=100`, token),
            safeExternalFetch(`https://github-contributions-api.jogruber.de/v4/${key}?y=last`)
        ]);

        if (!userData) {
            return { success: true, stats: fallbackStats(), fallback: true };
        }

        const streak = events
            ? Math.min(30, Math.floor(events.length / 4) + 2)
            : 0;

        const totalContributions =
            heatmap?.total?.lastYear ||
            heatmap?.years?.[0]?.total ||
            0;

        const activeDays =
            heatmap?.contributions?.filter((c: any) => c.count > 0).length || 0;

        let levelTitle = "Beginner";
        let levelCode = "L1";
        let progress = 0;

        if (totalContributions > 300) {
            levelTitle = "Expert";
            levelCode = "L3";
            progress = Math.min(100, ((totalContributions - 300) / 700) * 100);
        } else if (totalContributions >= 100) {
            levelTitle = "Intermediate";
            levelCode = "L2";
            progress = ((totalContributions - 100) / 200) * 100;
        } else {
            progress = (totalContributions / 100) * 100;
        }

        const finalStats = {
            level: `${levelCode} ${levelTitle}`,
            levelCode,
            levelTitle,
            progress: Math.floor(progress),
            totalXP: totalContributions,
            displayXP: totalContributions * 10,
            streak,
            activeDays,
            repos: userData.public_repos || 0,
            followers: userData.followers || 0,
            contributions: totalContributions,
            claimedBadges: []
        };

        await setCached(key, finalStats);

        return { success: true, stats: finalStats };

    } catch (error) {
        console.error("Dashboard failed:", error);
        return { success: true, stats: fallbackStats(), fallback: true };
    }
}

function extractRepo(url: string): string | null {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : null;
    } catch {
        return null;
    }
}

async function fetchReposLimited(
    githubHandle: string,
    token?: string,
    maxPages = 3
) {
    const perPage = 100;
    let page = 1;
    const all: any[] = [];

    while (page <= maxPages) {
        const batch = await safeGithubFetch(
            `https://api.github.com/users/${githubHandle}/repos?per_page=${perPage}&page=${page}`,
            token
        );

        if (!Array.isArray(batch) || batch.length === 0) break;

        all.push(...batch);

        if (batch.length < perPage) break;
        page++;
    }

    return {
        repos: all,
        truncated: page > maxPages
    };
}

export async function getProfileData(
    githubHandle: string,
    token?: string
) {
    const resolvedHandle = await resolveGithubIdentity(token, githubHandle);
    if (!resolvedHandle) {
        return { success: false };
    }

    const key = resolvedHandle;

    try {
        const [userData, prsData] = await Promise.all([
            safeGithubFetch(`https://api.github.com/users/${key}`, token),
            safeGithubFetch(`https://api.github.com/search/issues?q=author:${key}+type:pr+is:merged`, token)
        ]);

        if (!userData) {
            return {
                success: true,
                fallback: true,
                user: {
                    name: githubHandle,
                    github: githubHandle,
                    bio: "GitHub unavailable",
                    location: "",
                    joined: "",
                    avatar_url: "",
                    public_repos: 0,
                    followers: 0
                },
                skills: [],
                contributions: [],
                mergedPRs: 0,
                skillsMeta: { truncated: false }
            };
        }

        const { repos, truncated } = await fetchReposLimited(key, token, 3);

        const langMap: Record<string, number> = {};
        let total = 0;

        repos.forEach((repo: any) => {
            if (repo.language) {
                langMap[repo.language] = (langMap[repo.language] || 0) + 1;
                total++;
            }
        });

        const skills = Object.entries(langMap)
            .map(([name, count]) => ({
                name,
                level: total ? Math.floor((count / total) * 100) : 0
            }))
            .sort((a, b) => b.level - a.level)
            .slice(0, 5);

        return {
            success: true,
            user: {
                name: userData.name || userData.login,
                github: userData.login,
                bio: userData.bio || "",
                location: userData.location || "",
                joined: userData.created_at,
                avatar_url: userData.avatar_url,
                public_repos: userData.public_repos,
                followers: userData.followers
            },
            skills,
            mergedPRs: prsData?.total_count || 0,
            skillsMeta: {
                truncated
            },
            contributions: prsData?.items?.slice(0, 5).map((pr: any) => ({
                title: pr.title,
                repo: extractRepo(pr.repository_url) || "unknown",
                merged: new Date(pr.closed_at).toLocaleDateString(),
                url: pr.html_url
            })) || []
        };

    } catch (e) {
        console.error("Profile failed:", e);
        return {
            success: true,
            fallback: true,
            user: {
                name: githubHandle,
                github: githubHandle,
                bio: "GitHub data unavailable",
                location: "",
                joined: "",
                avatar_url: "",
                public_repos: 0,
                followers: 0
            },
            skills: [],
            mergedPRs: 0,
            contributions: [],
            skillsMeta: { truncated: false }
        };
    }
}