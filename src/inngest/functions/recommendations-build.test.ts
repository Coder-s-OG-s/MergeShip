import { describe, it, expect, vi, beforeEach } from 'vitest';
import { filterAndRank } from '@/lib/pipeline/recommend';
import { recommendationsBuild } from './recommendations-build';
import { sb, wire, step } from './test-helpers';

// Mock external dependencies.
vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/pipeline/recommend', () => ({ filterAndRank: vi.fn() }));
vi.mock('../client', () => ({
  inngest: { createFunction: (_c: unknown, _t: unknown, h: Function) => h },
}));

// Handler reference — createFunction mock passes the raw handler through.
const run = recommendationsBuild as unknown as (ctx: {
  step: typeof step;
}) => Promise<{ users: number; inserted: number }>;

// Factory for a scored issue row.
const issue = (
  id: number,
  difficulty: 'E' | 'M' | 'H' = 'E',
  lang: string | null = 'TypeScript',
) => ({
  id,
  repo_full_name: 'org/repo',
  github_issue_number: id,
  title: `Issue ${id}`,
  difficulty,
  xp_reward: difficulty === 'E' ? 50 : difficulty === 'M' ? 150 : 400,
  repo_health_score: 80,
  repo_language: lang,
  scored_at: new Date().toISOString(),
});

// Factory for a user row returned by github_installations join.
const user = (id: string, level = 0, lang: string | null = null) => ({
  user_id: id,
  profiles: { level, primary_language: lang },
});

describe('recommendationsBuild', () => {
  beforeEach(() => vi.clearAllMocks());

  it('creates correct number of recs matching filterAndRank output', async () => {
    wire({
      issues: sb({
        limit: vi.fn().mockResolvedValue({ data: [issue(1, 'E'), issue(2, 'M'), issue(3, 'H')] }),
      }),
      github_installations: sb({ not: vi.fn().mockResolvedValue({ data: [user('u1', 1)] }) }),
      recommendations: sb({
        eq: vi.fn().mockResolvedValue({ data: [] }),
        upsert: vi.fn().mockResolvedValue({ error: null }),
      }),
    });
    vi.mocked(filterAndRank).mockReturnValue([
      { id: 1, difficulty: 'E', xpReward: 50 },
      { id: 3, difficulty: 'H', xpReward: 400 },
    ] as never);

    expect(await run({ step })).toEqual({ users: 1, inserted: 2 });
  });

  it('excludes already-seen issues so no duplicates are created', async () => {
    wire({
      issues: sb({ limit: vi.fn().mockResolvedValue({ data: [issue(1), issue(2), issue(3)] }) }),
      github_installations: sb({ not: vi.fn().mockResolvedValue({ data: [user('u1')] }) }),
      recommendations: sb({
        eq: vi.fn().mockResolvedValue({ data: [{ issue_id: 1 }, { issue_id: 3 }] }),
      }),
    });
    vi.mocked(filterAndRank).mockReturnValue([]);

    await run({ step });

    expect(filterAndRank).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ excludeIssueIds: new Set([1, 3]) }),
    );
  });

  it('passes user level to filterAndRank for difficulty distribution', async () => {
    wire({
      issues: sb({ limit: vi.fn().mockResolvedValue({ data: [issue(1, 'E'), issue(2, 'M')] }) }),
      github_installations: sb({
        not: vi.fn().mockResolvedValue({ data: [user('u1', 4, 'Python')] }),
      }),
      recommendations: sb({ eq: vi.fn().mockResolvedValue({ data: [] }) }),
    });
    vi.mocked(filterAndRank).mockReturnValue([]);

    await run({ step });

    expect(filterAndRank).toHaveBeenCalledWith(expect.anything(), {
      level: 4,
      excludeIssueIds: new Set(),
      allowFallback: true,
    });
  });
});
