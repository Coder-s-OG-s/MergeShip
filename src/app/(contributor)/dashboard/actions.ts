"use server";

const CACHE_TTL = 1000 * 60 * 60;

// NOTE:
// In-memory cache is instance-local and not suitable for serverless scale.
// Replace with Redis or persistent store in production.
const statsCache = new Map<string, { statsJson: string; lastSync: number }>();

/**
 * SAFE GitHub fetch (token optional)
 */
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

/**
 * External API (no auth)
 */
async function safeExternalFetch(url: string) {
    try {
        const res = await fetch(url);
        return res.ok ? await res.json() : null;
    } catch (e) {
        console.error("[MergeShip] External fetch error:", e);
        return null;
    }
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
        totalXP: "0",
        displayXP: "0",
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
    const key = githubHandle.toLowerCase();

    // Cache
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

        // HARD FALLBACK → never crash UI
        if (!userData) {
            return {
                success: true,
                stats: fallbackStats(),
                fallback: true
            };
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
        let progress = (totalContributions / 100) * 100;

        if (totalContributions > 300) {
            levelTitle = "Expert";
            levelCode = "L3";
            progress = ((totalContributions - 300) / 700) * 100;
        } else if (totalContributions >= 100) {
            levelTitle = "Intermediate";
            levelCode = "L2";
            progress = ((totalContributions - 100) / 200) * 100;
        }

        const existing = await getCached(key);
        const existingStats = existing ? JSON.parse(existing.statsJson) : {};

        const finalStats = {
            ...existingStats,
            level: `${levelCode} ${levelTitle}`,
            levelCode,
            levelTitle,
            progress: Math.floor(progress),
            totalXP: totalContributions.toLocaleString(),
            displayXP: (totalContributions * 10).toLocaleString(),
            streak,
            activeDays,
            repos: userData.public_repos || 0,
            followers: userData.followers || 0,
            contributions: totalContributions,
            claimedBadges: existingStats.claimedBadges || []
        };

        await setCached(key, finalStats);

        return { success: true, stats: finalStats };

    } catch (error) {
        console.error("Dashboard failed:", error);
        return { success: true, stats: fallbackStats(), fallback: true };
    }
}

function extractRepo(url: string) {
    try {
        const u = new URL(url);
        const parts = u.pathname.split("/").filter(Boolean);
        return parts.length >= 2 ? `${parts[0]}/${parts[1]}` : url;
    } catch {
        return url;
    }
}

export async function getProfileData(
    githubHandle: string,
    token?: string
) {
    const key = githubHandle.toLowerCase();

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
                mergedPRs: 0
            };
        }

        const repos = await safeGithubFetch(
            `https://api.github.com/users/${key}/repos?per_page=100`,
            token
        ) || [];

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
                joined: new Date(userData.created_at).toLocaleDateString(),
                avatar_url: userData.avatar_url,
                public_repos: userData.public_repos,
                followers: userData.followers
            },
            skills,
            mergedPRs: prsData?.total_count || 0,
            contributions: prsData?.items?.slice(0, 5).map((pr: any) => ({
                title: pr.title,
                repo: extractRepo(pr.repository_url),
                merged: new Date(pr.closed_at).toLocaleDateString(),
                url: pr.html_url
            })) || []
        };

    } catch (e) {
        console.error("Profile failed:", e);
        return { success: false };
    }
}