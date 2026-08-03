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

const installsMock = () =>
  sb({ limit: vi.fn().mockResolvedValue({ data: [{ id: 1, account_login: 'test-org' }] }) });

const reposMock = (rows: Array<{ repo_full_name: string }>) =>
  sb({ limit: vi.fn().mockResolvedValue({ data: rows }) });

const baseOctokit = () => ({
  repos: {
    get: vi.fn().mockResolvedValue({ data: { fork: false, parent: null } }),
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
});

describe('issuesSweep', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('sweeps issues and triggers recommendations build', async () => {
    const issues = sb({ upsert: vi.fn().mockResolvedValue({}) });
    wire({
      github_installations: installsMock(),
      installation_repositories: reposMock([{ repo_full_name: 'test-org/repo-1' }]),
      issues,
    });

    vi.mocked(getInstallOctokit).mockResolvedValue(baseOctokit() as never);
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
      github_installations: installsMock(),
      installation_repositories: reposMock([{ repo_full_name: 'test-org/repo-1' }]),
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

  it('self-heals empty installation_repositories by discovering repos via GitHub API and triggering pr-backfill', async () => {
    const reposUpsert = vi.fn().mockResolvedValue({});
    wire({
      github_installations: installsMock(),
      installation_repositories: sb({
        limit: vi.fn().mockResolvedValue({ data: [] }),
        upsert: reposUpsert,
      }),
    });

    const octokit = {
      paginate: vi.fn().mockResolvedValue([{ full_name: 'test-org/recovered-repo' }]),
      apps: { listReposAccessibleToInstallation: {} },
      repos: {
        get: vi.fn().mockResolvedValue({
          data: { fork: false, parent: null },
        }),
      },
      issues: {
        listForRepo: vi.fn().mockResolvedValue({ data: [] }),
      },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(fetchRepoMetrics).mockResolvedValue({ language: 'TypeScript' } as never);
    vi.mocked(repoHealth).mockReturnValue(85);

    const result = await run({ step });

    expect(octokit.paginate).toHaveBeenCalled();
    expect(reposUpsert).toHaveBeenCalledWith(
      [{ installation_id: 1, repo_full_name: 'test-org/recovered-repo' }],
      { onConflict: 'installation_id,repo_full_name' },
    );
    expect(mockSend).toHaveBeenCalledWith({
      name: 'pr-backfill/installation',
      data: { installationId: 1 },
    });
    expect(result).toEqual(
      expect.objectContaining({
        installs: 1,
        perInstall: expect.arrayContaining([
          expect.objectContaining({
            repos: 1,
          }),
        ]),
      }),
    );
  });

  it('reuses cached difficulty without invoking the LLM', async () => {
    const issuesUpsert = vi.fn().mockResolvedValue({});
    wire({
      github_installations: installsMock(),
      installation_repositories: reposMock([{ repo_full_name: 'test-org/repo-1' }]),
      issues: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              github_issue_number: 101,
              difficulty: 'H',
              difficulty_source: 'label',
              xp_reward: 250,
              scored_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString(),
            },
          ],
        }),
        upsert: issuesUpsert,
      }),
    });

    vi.mocked(getInstallOctokit).mockResolvedValue(baseOctokit() as never);
    vi.mocked(fetchRepoMetrics).mockResolvedValue({ language: 'TypeScript' } as never);
    vi.mocked(repoHealth).mockReturnValue(85);

    await run({ step });

    expect(scoreDifficulty).not.toHaveBeenCalled();
    expect(issuesUpsert).toHaveBeenCalledWith(
      expect.objectContaining({
        github_issue_number: 101,
        difficulty: 'H',
        difficulty_source: 'label',
        xp_reward: 250,
      }),
      { onConflict: 'repo_full_name,github_issue_number' },
    );
  });

  it('skips re-scoring issues attempted within the last 24h', async () => {
    const issuesUpsert = vi.fn().mockResolvedValue({});
    wire({
      github_installations: installsMock(),
      installation_repositories: reposMock([{ repo_full_name: 'test-org/repo-1' }]),
      issues: sb({
        select: vi.fn().mockReturnThis(),
        eq: vi.fn().mockReturnThis(),
        in: vi.fn().mockResolvedValue({
          data: [
            {
              github_issue_number: 101,
              difficulty: null,
              difficulty_source: null,
              xp_reward: 0,
              scored_at: new Date().toISOString(),
            },
          ],
        }),
        upsert: issuesUpsert,
      }),
    });

    vi.mocked(getInstallOctokit).mockResolvedValue(baseOctokit() as never);
    vi.mocked(fetchRepoMetrics).mockResolvedValue({ language: 'TypeScript' } as never);
    vi.mocked(repoHealth).mockReturnValue(85);

    await run({ step });

    expect(scoreDifficulty).not.toHaveBeenCalled();
    expect(issuesUpsert).not.toHaveBeenCalled();
  });

  it('does not advance the per-repo cursor when the issue budget truncates a full page', async () => {
    const cursorUpsert = vi.fn().mockResolvedValue({});
    const cursorDelete = vi.fn().mockResolvedValue({});
    wire({
      github_installations: installsMock(),
      installation_repositories: reposMock([
        { repo_full_name: 'test-org/repo-1' },
        { repo_full_name: 'test-org/repo-2' },
        { repo_full_name: 'test-org/repo-3' },
        { repo_full_name: 'test-org/repo-4' },
      ]),
      issues: sb({ upsert: vi.fn().mockResolvedValue({}) }),
      repo_sync_cursors: sb({ upsert: cursorUpsert, delete: cursorDelete }),
    });

    const fullPage = Array.from({ length: 30 }, (_, i) => ({
      number: 100 + i,
      title: `issue ${i}`,
      body: 'body',
      html_url: 'https://github.com/test-org/repo-1/issues/100',
      comments: 0,
      labels: [],
    }));

    const octokit = {
      repos: { get: vi.fn().mockResolvedValue({ data: { fork: false, parent: null } }) },
      issues: { listForRepo: vi.fn().mockResolvedValue({ data: fullPage }) },
    };
    vi.mocked(getInstallOctokit).mockResolvedValue(octokit as never);
    vi.mocked(fetchRepoMetrics).mockResolvedValue({ language: 'TypeScript' } as never);
    vi.mocked(repoHealth).mockReturnValue(85);
    vi.mocked(scoreDifficulty).mockResolvedValue({
      difficulty: 'M',
      source: 'llm',
      confidence: 1,
      xpReward: 100,
    });

    await run({ step });

    // Repos 1-3 drain full pages (30/30) and advance their cursors; repo-4
    // hits the install-wide budget mid-page (10/30), so its cursor must be
    // left in place so the unprocessed issues are retried next sweep.
    expect(cursorUpsert).toHaveBeenCalledTimes(3);
    expect(cursorDelete).not.toHaveBeenCalled();
  });
});
