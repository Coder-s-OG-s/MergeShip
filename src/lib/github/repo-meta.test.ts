import { describe, it, expect } from 'vitest';
import { mapRepoMeta, type RepoMetaResponse } from './repo-meta';

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
