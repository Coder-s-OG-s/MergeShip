export function parsePRState(
  apiState: string,
  mergedAt: string | null,
): 'open' | 'closed' | 'merged' {
  if (mergedAt != null) return 'merged';
  if (apiState === 'open') return 'open';
  return 'closed';
}

export function calculateStreak(
  days: { date: string; contributionCount: number }[],
  today: string,
): number {
  const sorted = [...days]
    .filter((d) => d.date <= today)
    .sort((a, b) => b.date.localeCompare(a.date));

  let streak = 0;
  let expectingDate: string | null = null;

  for (const day of sorted) {
    if (expectingDate === null) {
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        expectingDate = prevDay(day.date);
        continue;
      }
    } else {
      if (day.date !== expectingDate) break;
      if (day.contributionCount > 0) {
        streak++;
        expectingDate = prevDay(day.date);
      } else {
        break;
      }
    }
  }

  return streak;
}

function prevDay(dateStr: string): string {
  const d = new Date(dateStr);
  d.setUTCDate(d.getUTCDate() - 1);
  return d.toISOString().slice(0, 10);
}

export async function fetchMergedCount(token: string, handle: string): Promise<number> {
  const res = await fetch(
    `https://api.github.com/search/issues?q=is:pr+is:merged+author:${handle}&per_page=1`,
    {
      headers: {
        Authorization: `Bearer ${token}`,
        Accept: 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
      },
    },
  );
  if (!res.ok) throw new Error(`GitHub Search API ${res.status}`);
  const data = (await res.json()) as { total_count: number };
  return data.total_count;
}

export async function fetchContributionStreak(token: string, login: string): Promise<number> {
  const to = new Date();
  const from = new Date(to);
  from.setFullYear(from.getFullYear() - 1);

  const query = `
    query($login: String!, $from: DateTime!, $to: DateTime!) {
      user(login: $login) {
        contributionsCollection(from: $from, to: $to) {
          contributionCalendar {
            weeks {
              contributionDays {
                date
                contributionCount
              }
            }
          }
        }
      }
    }
  `;

  const res = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables: { login, from: from.toISOString(), to: to.toISOString() },
    }),
  });

  if (!res.ok) throw new Error(`GitHub GraphQL ${res.status}`);
  const json = (await res.json()) as {
    data?: {
      user?: {
        contributionsCollection?: {
          contributionCalendar?: {
            weeks: { contributionDays: { date: string; contributionCount: number }[] }[];
          };
        };
      };
    };
  };

  const weeks = json.data?.user?.contributionsCollection?.contributionCalendar?.weeks ?? [];
  const days = weeks.flatMap((w) => w.contributionDays);
  const today = new Date().toISOString().slice(0, 10);
  return calculateStreak(days, today);
}
