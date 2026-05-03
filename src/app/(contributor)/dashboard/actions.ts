"use server";

const CACHE_TTL = 1000 * 60 * 60;
const statsCache = new Map<string, { statsJson: string; lastSync: number }>();

/**
 * External API fetch (NO AUTH EVER)
 */
async function safeExternalFetch(url: string) {
    try {
        const res = await fetch(url);
        return res.ok ? await res.json() : null;
    } catch (err) {
        console.error("[MergeShip] External fetch error:", err);
        return null;
    }
}

/**
 * GitHub fetch (SAFE, optionally authenticated)
 */
async function safeGithubFetch(url: string, token?: string) {
    if (!url.startsWith("https://api.github.com/")) {
        console.error("[MergeShip] Blocked non-GitHub request");
        return null;
    }

    try {
        const res = await fetch(url, {
            headers: token
                ? { Authorization: `Bearer ${token}` }
                : {}
        });

        if (res.status === 403) {
            console.warn("[MergeShip] GitHub rate limit likely exceeded");
        }

        return res.ok ? await res.json() : null;
    } catch (err) {
        console.error("[MergeShip] GitHub fetch error:", err);
        return null;
    }
}

async function getCachedUserStats(key: string) {
    return statsCache.get(key) || null;
}

async function setCachedUserStats(key: string, data: any) {
    statsCache.set(key, {
        statsJson: JSON.stringify(data),
        lastSync: Date.now(),
    });
}

export async function getDashboardData(githubHandle: string, forceSync = false) {
    const key = githubHandle.toLowerCase();

    // Cache check
    if (!forceSync) {
        const cached = await getCachedUserStats(key);
        if (cached && Date.now() - cached.lastSync < CACHE_TTL) {
            return { success: true, stats: JSON.parse(cached.statsJson), fromCache: true };
        }
    }

    try {
        const userData = await safeGithubFetch(
            `https://api.github.com/users/${key}`
        );

        if (!userData) {
            return { success: false, error: "GitHub user fetch failed" };
        }

        const [events, heatmap] = await Promise.all([
            safeGithubFetch(`https://api.github.com/users/${key}/events/public?per_page=100`),
            safeExternalFetch(`https://github-contributions-api.jogruber.de/v4/${key}?y=last`)
        ]);

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

        const existing = await getCachedUserStats(key);
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

        await setCachedUserStats(key, finalStats);
         // NOTE: This uses a non-atomic in-memory merge.
 // In concurrent scenarios, updates may still be overwritten.
 // A production-safe solution would require transactional storage or locking.
        return { success: true, stats: finalStats };

    } catch (error) {
        console.error("Dashboard data fetch failed", error);
        return { success: false };
    }
}

export async function getProfileData(githubHandle: string, token?: string) {
    try {
        const key = githubHandle.toLowerCase();

        const userData = await safeGithubFetch(
            `https://api.github.com/users/${key}`,
            token
        );

        if (!userData) return { success: false };

        const prsData = await safeGithubFetch(
            `https://api.github.com/search/issues?q=author:${key}+type:pr+is:merged`,
            token
        );

        const repos = await safeGithubFetch(
            `https://api.github.com/users/${key}/repos?per_page=15`,
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
                repo: pr.repository_url.split('/').slice(-2).join('/'),
                merged: new Date(pr.closed_at).toLocaleDateString(),
                url: pr.html_url
            })) || []
        };

    } catch (e) {
        console.error("Profile fetch failed", e);
        return { success: false };
    }
}