import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getInstallOctokit } from '@/lib/github/app';
import { scoreDifficulty, repoHealth } from '@/lib/pipeline/score';
import { fetchRepoMetrics } from '@/lib/github/repo-meta';
import { issuesSweep } from './issues-sweep';
import { sb, wire, step } from './__tests__/test-helpers';

vi.mock('@/lib/supabase/service', () => ({ getServiceSupabase: vi.fn() }));
vi.mock('@/lib/llm/router', () => ({ llmCall: vi.fn() }));
vi.mock('@/lib/github/app', () => ({ getInstallOctokit: vi.fn() }));
vi.mock('@/lib/pipeline/score', () => ({
  scoreDifficulty: vi.fn(),
  repoHealth: vi.fn(),
}));
vi.mock('@/lib/github/repo-meta', () => ({ fetchRepoMetrics: vi.fn() }));

const mockSend = vi.fn();
vi.mock('../client', () => ({
  inngest: {
    createFunction: (_c: unknown, _t: unknown, h: Function) => h,
    send: (...args: unknown[]) => mockSend(...args),
  },
}));

const run = issuesSweep as unknown as (ctx: { step: typeof step }) => Promise<unknown>;

describe('issuesSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sweeps issues and triggers recommendations build', async () => {
    const issues = sb({ upsert: vi.fn().mockResolvedValue({}) });
    wire({
      github_installations: sb({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [{ id: 1, account_login: 'test-org' }] }),
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ repo_full_name: 'test-org/repo-1' }],
        }),
      }),
      issues,
    });

    const octokit = {
      repos: {
        get: vi.fn().mockResolvedValue({
          data: { fork: false, parent: null },
        }),
      },
      issues: {
        listForRepo: vi.fn().mockResolvedValue({
          data: [
            {
              number: 101,
              title: 'Fix bug',
              body: 'Bug description',
              html_url: 'https://github.com/test-org/repo-1/issues/101',
              comments: 2,
              labels: ['bug'],
            },
            {
              number: 102,
              title: 'Is a PR',
              pull_request: {}, // Should be skipped
            },
          ],
        }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(fetchRepoMetrics).mockResolvedValue({ language: 'TypeScript' } as never);
    vi.mocked(repoHealth).mockReturnValue(85);
    vi.mocked(scoreDifficulty).mockResolvedValue({
      difficulty: 'M',
      source: 'label',
      confidence: 1,
      xpReward: 100,
    });

    const result = await run({ step });

    expect(issues.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        repo_full_name: 'test-org/repo-1',
        github_issue_number: 101,
        title: 'Fix bug',
        difficulty: 'M',
        xp_reward: 100,
        state: 'open',
      }),
      { onConflict: 'repo_full_name,github_issue_number' },
    );
    expect(mockSend).toHaveBeenCalledWith({ name: 'recommendations/build', data: {} });

    expect(result).toEqual(
      expect.objectContaining({
        installs: 1,
        totalUpserts: 1,
      }),
    );
  });

  it('handles github api errors gracefully', async () => {
    wire({
      github_installations: sb({
        select: vi.fn().mockReturnThis(),
        is: vi.fn().mockReturnValue({
          is: vi.fn().mockResolvedValue({ data: [{ id: 1, account_login: 'test-org' }] }),
        }),
      }),
      installation_repositories: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({
          data: [{ repo_full_name: 'test-org/repo-1' }],
        }),
      }),
    });

    vi.mocked(getInstallOctokit).mockRejectedValue(new Error('Bad credentials'));

    const result = await run({ step });

    expect(result).toEqual(
      expect.objectContaining({
        installs: 1,
        totalUpserts: 0,
        perInstall: expect.arrayContaining([
          expect.objectContaining({
            errors: ['install-token: Bad credentials'],
          }),
        ]),
      }),
    );
  });
});
