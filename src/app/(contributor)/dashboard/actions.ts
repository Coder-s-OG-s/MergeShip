"use server";

const DATABASE_ID = '69dd3854002de2030bc5';
const COLLECTION_ID = 'user_stats';
const CACHE_TTL = 1000 * 60 * 60; // 1 hour
const statsCache = new Map<string, { statsJson: string; lastSync: number }>();

function sanitizeIssueText(value: unknown): string {
    if (typeof value !== "string") return "";
    return value.replace(/[\r\n\t]+/g, " ").trim().slice(0, 280);
}

async function getAppwriteUserStats(githubHandle: string) {
    const cached = statsCache.get(githubHandle.toLowerCase());
    return cached || null;
}

async function updateAppwriteUserStats(githubHandle: string, data: any) {
    statsCache.set(githubHandle.toLowerCase(), {
        statsJson: JSON.stringify(data),
        lastSync: Date.now(),
    });
    return true;
}

async function safeGithubFetch(url: string, headers: HeadersInit = {}) {
    try {
        const res = await fetch(url, { headers });

        if (res.status === 403) {
            console.warn("[MergeShip] GitHub rate limit likely exceeded");
        }

        if (!res.ok) {
            console.warn(`[MergeShip] GitHub API failed: ${res.status}`);
            return null;
        }

        return await res.json();
    } catch (err) {
        console.error("[MergeShip] GitHub fetch error:", err);
        return null;
    }
}

export async function getDashboardData(githubHandle: string, forceSync = false) {
    if (!forceSync) {
        const cached = await getAppwriteUserStats(githubHandle);
        if (cached && Date.now() - cached.lastSync < CACHE_TTL) {
            const stats = JSON.parse(cached.statsJson);
            if (stats.activeDays !== undefined) {
                return { success: true, stats, fromCache: true };
            }
        }
    }

    try {
        const userData = await safeGithubFetch(`https://api.github.com/users/${githubHandle}`);

        if (!userData) {
            return {
                success: true,
                fallback: true,
                stats: {
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
                }
            };
        }

        const events = await safeGithubFetch(
            `https://api.github.com/users/${githubHandle}/events/public?per_page=100`
        );

        let streak = events ? Math.min(30, Math.floor(events.length / 4) + 2) : 0;

        let totalContributions = 0;
        let activeDays = 0;

        try {
            const heatmap = await safeGithubFetch(
                `https://github-contributions-api.jogruber.de/v4/${githubHandle}?y=last`
            );

            if (heatmap) {
                totalContributions =
                    heatmap.total?.lastYear ||
                    heatmap.years?.[0]?.total ||
                    0;

                activeDays =
                    heatmap.contributions?.filter((c: any) => c.count > 0).length || 0;
            }
        } catch {}

        let levelTitle = "Beginner";
        let levelCode = "L1";
        let progress = 0;
        const totalXP = totalContributions * 10;

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

        const existing = await getAppwriteUserStats(githubHandle);
        const claimedBadges = existing
            ? JSON.parse(existing.statsJson).claimedBadges || []
            : [];

        const finalStats = {
            level: `${levelCode} ${levelTitle}`,
            levelCode,
            levelTitle,
            progress: Math.floor(progress),
            totalXP: totalContributions.toLocaleString(),
            displayXP: totalXP.toLocaleString(),
            streak,
            activeDays,
            repos: userData.public_repos || 0,
            followers: userData.followers || 0,
            contributions: totalContributions,
            claimedBadges
        };

        await updateAppwriteUserStats(githubHandle, finalStats);

        return { success: true, stats: finalStats };
    } catch (error) {
        console.error("Dashboard data fetch failed", error);
        return { success: false };
    }
}

export async function getProfileData(
    githubHandle: string,
    token?: string,
    dashboardStats?: any
) {
    try {
        const headers: HeadersInit = token
            ? { Authorization: `Bearer ${token}` }
            : {};

        const userData = await safeGithubFetch(
            `https://api.github.com/users/${githubHandle}`,
            headers
        );

        if (!userData) {
            return {
                success: true,
                fallback: true,
                user: {
                    name: githubHandle,
                    github: githubHandle,
                    bio: "GitHub data unavailable",
                    location: "Unknown",
                    joined: "N/A",
                    avatar_url: "",
                    public_repos: 0,
                    followers: 0
                },
                skills: [],
                contributions: [],
                mergedPRs: 0,
                stats: dashboardStats || {}
            };
        }

        const prsData =
            (await safeGithubFetch(
                `https://api.github.com/search/issues?q=author:${githubHandle}+type:pr+is:merged`,
                headers
            )) || {};

        const issuesData =
            (await safeGithubFetch(
                `https://api.github.com/search/issues?q=author:${githubHandle}+type:issue+is:closed`,
                headers
            )) || {};

        const repos =
            (await safeGithubFetch(
                `https://api.github.com/users/${githubHandle}/repos?per_page=15`,
                headers
            )) || [];

        const langMap: Record<string, number> = {};
        let totalLangPoints = 0;

        if (Array.isArray(repos)) {
            for (const repo of repos) {
                if (repo.language) {
                    langMap[repo.language] = (langMap[repo.language] || 0) + 1;
                    totalLangPoints++;
                }
            }
        }

        const skills = Object.entries(langMap)
            .map(([name, count]) => ({
                name,
                level: Math.floor((count / totalLangPoints) * 100)
            }))
            .sort((a, b) => b.level - a.level)
            .slice(0, 5);

        const contributions =
            prsData.items?.slice(0, 5).map((pr: any) => ({
                title: pr.title,
                repo: pr.repository_url.split('/').slice(-2).join('/'),
                merged: new Date(pr.closed_at).toLocaleDateString(),
                xp: 150,
                difficulty: "medium",
                url: pr.html_url
            })) || [];

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
            contributions,
            mergedPRs: prsData.total_count || 0,
            stats: dashboardStats || {}
        };
    } catch (e) {
        console.error("Profile fetch failed", e);
        return { success: false };
    }
}