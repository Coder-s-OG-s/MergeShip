import { describe, it, expect, beforeEach } from 'vitest';
import { mapRepoMeta, fetchRepoMetrics, type RepoMetaResponse } from './repo-meta';
import { __setMemoryCache } from '../cache';

const baseMeta: RepoMetaResponse = {
  stargazers_count: 250,
  pushed_at: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
  license: { spdx_id: 'MIT' },
};

describe('mapRepoMeta', () => {
  it('high-activity public repo scores well', () => {
    const out = mapRepoMeta(baseMeta, { recentCommits30d: 20, hasContributingMd: true });
    expect(out.stars).toBe(250);
    expect(out.recentCommits30d).toBe(20);
    expect(out.hasLicense).toBe(true);
    expect(out.hasContributingMd).toBe(true);
  });

  it('missing license flag', () => {
    const out = mapRepoMeta({ ...baseMeta, license: null }, { recentCommits30d: 1 });
    expect(out.hasLicense).toBe(false);
  });

  it('treats license with no SPDX id as no license', () => {
    const out = mapRepoMeta({ ...baseMeta, license: { spdx_id: null } }, { recentCommits30d: 1 });
    expect(out.hasLicense).toBe(false);
  });

  it('passes through hasContributingMd flag', () => {
    expect(
      mapRepoMeta(baseMeta, { recentCommits30d: 5, hasContributingMd: false }).hasContributingMd,
    ).toBe(false);
    expect(
      mapRepoMeta(baseMeta, { recentCommits30d: 5, hasContributingMd: true }).hasContributingMd,
    ).toBe(true);
  });

  it('defaults hasContributingMd to false when not provided', () => {
    expect(mapRepoMeta(baseMeta, { recentCommits30d: 5 }).hasContributingMd).toBe(false);
  });

  it('clamps negative stars to zero', () => {
    expect(mapRepoMeta({ ...baseMeta, stargazers_count: -1 }, { recentCommits30d: 0 }).stars).toBe(
      0,
    );
  });
});

type FakeOctokit = {
  repos: {
    get: (args: { owner: string; repo: string }) => Promise<{ data: RepoMetaResponse }>;
    listCommits: (args: {
      owner: string;
      repo: string;
      since: string;
    }) => Promise<{ data: unknown[] }>;
    getContent: (args: { owner: string; repo: string; path: string }) => Promise<unknown>;
  };
};

function makeOctokit(opts: {
  meta?: Partial<RepoMetaResponse>;
  commits?: number;
  hasContributing?: boolean;
  failMeta?: boolean;
}): FakeOctokit {
  return {
    repos: {
      async get() {
        if (opts.failMeta) throw new Error('meta fetch failed');
        return {
          data: {
            stargazers_count: 100,
            pushed_at: new Date().toISOString(),
            license: { spdx_id: 'MIT' },
            language: 'TypeScript',
            ...opts.meta,
          } as RepoMetaResponse,
        };
      },
      async listCommits() {
        return { data: Array.from({ length: opts.commits ?? 0 }) };
      },
      async getContent() {
        if (!opts.hasContributing) throw new Error('not found');
        return { data: { name: 'CONTRIBUTING.md' } };
      },
    },
  };
}

describe('fetchRepoMetrics', () => {
  beforeEach(() => __setMemoryCache());

  it('returns a populated metrics object on the happy path', async () => {
    const oc = makeOctokit({ commits: 7, hasContributing: true });
    const out = await fetchRepoMetrics(oc as never, 'acme', 'api');
    expect(out.stars).toBe(100);
    expect(out.recentCommits30d).toBe(7);
    expect(out.hasContributingMd).toBe(true);
    expect(out.hasLicense).toBe(true);
    expect(out.language).toBe('TypeScript');
  });

  it('falls back to safe zeros when repos.get rejects', async () => {
    const oc = makeOctokit({ failMeta: true });
    const out = await fetchRepoMetrics(oc as never, 'acme', 'broken');
    expect(out).toEqual({
      stars: 0,
      recentCommits30d: 0,
      hasContributingMd: false,
      hasLicense: false,
      language: null,
    });
  });

  it('treats getContent rejection as no CONTRIBUTING.md', async () => {
    const oc = makeOctokit({ commits: 2, hasContributing: false });
    const out = await fetchRepoMetrics(oc as never, 'acme', 'api');
    expect(out.hasContributingMd).toBe(false);
  });

  it('caches the result so a second call does not re-fetch', async () => {
    let calls = 0;
    const oc = makeOctokit({ commits: 3, hasContributing: true });
    const trackingOc: FakeOctokit = {
      repos: {
        async get(args) {
          calls += 1;
          return oc.repos.get(args);
        },
        async listCommits(args) {
          return oc.repos.listCommits(args);
        },
        async getContent(args) {
          return oc.repos.getContent(args);
        },
      },
    };
    await fetchRepoMetrics(trackingOc as never, 'acme', 'cached');
    await fetchRepoMetrics(trackingOc as never, 'acme', 'cached');
    expect(calls).toBe(1);
  });

  it('treats missing language as null', async () => {
    const oc = makeOctokit({ meta: { language: null }, commits: 0 });
    const out = await fetchRepoMetrics(oc as never, 'acme', 'no-lang');
    expect(out.language).toBeNull();
  });
});
