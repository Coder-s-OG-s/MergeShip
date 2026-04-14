"use server";

export async function getMaintainerDashboardData(githubHandle: string, token?: string) {
    try {
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        // 1. Fetch repositories maintained by the user
        // We look for repos where the user is an owner or has collaborator access
        const reposRes = await fetch(`https://api.github.com/user/repos?affiliation=owner,collaborator&sort=updated&per_page=10`, { headers });
        if (!reposRes.ok) throw new Error("Failed to fetch maintained repos");
        const repos = await reposRes.json();

        if (repos.length === 0) {
            return { success: true, empty: true };
        }

        const repoNames = repos.map((r: any) => r.full_name);
        const mainRepo = repoNames[0]; // Primary repo for detailed stats

        // 2. Fetch Issues and PRs for these repos
        // Total open issues across all maintained repos
        let totalOpenIssues = 0;
        let totalOpenPRs = 0;
        let urgentIssues: any[] = [];
        let openPRs: any[] = [];

        // For demo/simplicity, we'll focus on the first few repos but aggregate counts
        for (const repoName of repoNames.slice(0, 3)) {
            const issuesRes = await fetch(`https://api.github.com/repos/${repoName}/issues?state=open&per_page=30`, { headers });
            if (issuesRes.ok) {
                const items = await issuesRes.json();
                for (const item of items) {
                    if (item.pull_request) {
                        totalOpenPRs++;
                        if (openPRs.length < 5) {
                            // Get PR details for additions/deletions
                            const prDetailRes = await fetch(item.pull_request.url, { headers });
                            const prDetail = prDetailRes.ok ? await prDetailRes.json() : {};
                            
                            openPRs.push({
                                id: item.number,
                                title: item.title,
                                author: item.user.login,
                                additions: prDetail.additions || 0,
                                deletions: prDetail.deletions || 0,
                                status: prDetail.mergeable_state === "clean" ? "approved" : "pending",
                                repo: repoName,
                                url: item.html_url,
                                reviewers: [] // Need separate call if really needed
                            });
                        }
                    } else {
                        totalOpenIssues++;
                        // Urgent issues are those with high priority labels or no labels at all (triage needed)
                        const labels = item.labels.map((l: any) => l.name.toLowerCase());
                        const isUrgent = labels.some((l: string) => 
                            l.includes('bug') || l.includes('critical') || l.includes('urgent') || l.includes('high')
                        ) || labels.length === 0;

                        if (isUrgent && urgentIssues.length < 5) {
                            urgentIssues.push({
                                id: item.number,
                                priority: labels.includes('critical') ? "critical" : "high",
                                category: labels.includes('bug') ? "Bug" : "Feature",
                                repo: repoName,
                                title: item.title,
                                aiSummary: item.body?.slice(0, 150) || "No description provided.",
                                openedAt: new Date(item.created_at).toLocaleDateString(),
                                comments: item.comments,
                                contributor: {
                                    name: item.user.login,
                                    trustScore: 85
                                },
                                url: item.html_url
                            });
                        }
                    }
                }
            }
        }

        // 3. Fetch Team Members (Collaborators of the main repo)
        const collaboratorsRes = await fetch(`https://api.github.com/repos/${mainRepo}/collaborators`, { headers });
        let teamMembers: any[] = [];
        if (collaboratorsRes.ok) {
            const collabs = await collaboratorsRes.json();
            teamMembers = collabs.slice(0, 4).map((c: any) => ({
                id: c.login,
                name: c.login,
                role: c.permissions.admin ? "Lead Maintainer" : "Maintainer",
                status: Math.random() > 0.3 ? "online" : "offline", // Simulated status
                load: Math.floor(Math.random() * 60) + 30, // Simulated load %
                avatar: c.avatar_url
            }));
        }

        // 4. Stale Issues (Open for more than 30 days)
        const staleRes = await fetch(`https://api.github.com/search/issues?q=repo:${mainRepo}+state:open+created:<${new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]}`, { headers });
        let staleIssues: any[] = [];
        if (staleRes.ok) {
            const staleData = await staleRes.json();
            staleIssues = staleData.items.slice(0, 3).map((item: any) => ({
                id: item.number,
                title: item.title,
                repo: mainRepo,
                lastActivity: new Date(item.updated_at).toLocaleDateString(),
                priority: "low",
                url: item.html_url
            }));
        }

        // 5. Activity Feed
        const eventsRes = await fetch(`https://api.github.com/repos/${mainRepo}/events`, { headers });
        let activityFeed: any[] = [];
        if (eventsRes.ok) {
            const events = await eventsRes.json();
            // We need to import icons or map them to strings that the component handles
            // ActivityFeed component expects e.icon (an object) and e.color (a string)
            activityFeed = events.slice(0, 5).map((e: any) => ({
                type: e.type.replace('Event', '').toLowerCase(),
                user: e.actor.login,
                action: e.type === 'PushEvent' ? 'pushed code' : e.payload.action || 'activity',
                repo: mainRepo,
                time: "Recently",
                color: e.type === 'PushEvent' ? "#10B981" : "#A78BFA"
            }));
        }

        return {
            success: true,
            mainRepo,
            stats: {
                urgentCount: urgentIssues.length,
                openPRsCount: totalOpenPRs,
                teamOnline: teamMembers.filter(m => m.status === "online").length,
                teamTotal: teamMembers.length,
                mergedToday: 2 // Simulated
            },
            urgentIssues,
            openPRs,
            staleIssues,
            teamMembers: teamMembers.map(m => ({ ...m, workloadPercent: m.load, avatar: m.id.slice(0, 2).toUpperCase() })),
            activityFeed,
            repoHealth: [
                { repo: mainRepo, score: 85 },
                { repo: repoNames[1] || "secondary/repo", score: 72 },
                { repo: repoNames[2] || "tertiary/repo", score: 64 }
            ]
        };

    } catch (e) {
        console.error("Maintainer dashboard fetch failed", e);
        return { success: false };
    }
}

export async function getTriageData(githubHandle: string, token?: string) {
    try {
        const headers: HeadersInit = {};
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const reposRes = await fetch(`https://api.github.com/user/repos?affiliation=owner,collaborator&sort=updated&per_page=1`, { headers });
        if (!reposRes.ok) throw new Error("Failed to fetch repos");
        const repos = await reposRes.json();
        if (repos.length === 0) return { success: true, empty: true };
        const repoName = repos[0].full_name;

        // Fetch all open issues for triage
        const issuesRes = await fetch(`https://api.github.com/repos/${repoName}/issues?state=open&per_page=50`, { headers });
        const items = await issuesRes.json();
        
        const triageQueue: any[] = [];
        const categoryCounts: Record<string, number> = { Bug: 0, Feature: 0, Duplicate: 0, Question: 0, Docs: 0 };

        items.forEach((item: any) => {
            if (item.pull_request) return;

            const labels = item.labels.map((l: any) => l.name.toLowerCase());
            let category = "Question";
            if (labels.some((l: string) => l.includes('bug'))) category = "Bug";
            else if (labels.some((l: string) => l.includes('feat') || l.includes('enhancement'))) category = "Feature";
            else if (labels.some((l: string) => l.includes('doc'))) category = "Docs";
            else if (labels.some((l: string) => l.includes('duplicate'))) category = "Duplicate";

            categoryCounts[category]++;

            triageQueue.push({
                id: item.number,
                category,
                repo: repoName,
                title: item.title,
                aiSummary: item.body?.slice(0, 200) || "No description provided.",
                contributor: {
                    name: item.user.login,
                    trustScore: 85,
                    level: 2,
                    xp: 450
                },
                duplicateOf: labels.includes('duplicate') ? "PI007" : null, // Simulated duplicate detection
                url: item.html_url
            });
        });

        return {
            success: true,
            repoName,
            categoryCounts,
            triageQueue
        };
    } catch (e) {
        console.error("Triage fetch failed", e);
        return { success: false };
    }
}
