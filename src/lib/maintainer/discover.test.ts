import { describe, it, expect } from 'vitest';
import {
  decideOrgGrant,
  decideRepoGrant,
  reconcileGrants,
  type ExistingGrant,
  type ProposedGrant,
} from './discover';

describe('decideOrgGrant', () => {
  it('admin → org_admin grant', () => {
    expect(decideOrgGrant({ role: 'admin', state: 'active' })).toBe('org_admin');
  });

  it('member → no grant', () => {
    expect(decideOrgGrant({ role: 'member', state: 'active' })).toBeNull();
  });

  it('pending state → no grant', () => {
    expect(decideOrgGrant({ role: 'admin', state: 'pending' })).toBeNull();
  });

  it('null response → no grant', () => {
    expect(decideOrgGrant(null)).toBeNull();
  });
});

describe('decideRepoGrant', () => {
  it('admin permission → repo_admin', () => {
    expect(decideRepoGrant('admin')).toBe('repo_admin');
  });

  it('maintain permission → repo_maintain', () => {
    expect(decideRepoGrant('maintain')).toBe('repo_maintain');
  });

  it('write/triage/read → no grant', () => {
    expect(decideRepoGrant('write')).toBeNull();
    expect(decideRepoGrant('triage')).toBeNull();
    expect(decideRepoGrant('read')).toBeNull();
    expect(decideRepoGrant('none')).toBeNull();
  });

  it('garbage → no grant', () => {
    expect(decideRepoGrant('something' as never)).toBeNull();
  });
});

describe('reconcileGrants', () => {
  const existing = (perm: ExistingGrant['permissionLevel']): ExistingGrant => ({
    installationId: 1,
    permissionLevel: perm,
  });
  const proposed = (perm: ProposedGrant['permissionLevel']): ProposedGrant => ({
    installationId: 1,
    permissionLevel: perm,
    source: 'membership_check',
  });

  it('adds new grant', () => {
    const { toUpsert, toDelete } = reconcileGrants([], [proposed('org_admin')]);
    expect(toUpsert).toHaveLength(1);
    expect(toUpsert[0]!.permissionLevel).toBe('org_admin');
    expect(toDelete).toHaveLength(0);
  });

  it('drops grants the API no longer confirms', () => {
    const { toUpsert, toDelete } = reconcileGrants([existing('org_admin')], []);
    expect(toUpsert).toHaveLength(0);
    expect(toDelete).toEqual([1]);
  });

  it('keeps unchanged grants out of upsert list (no churn)', () => {
    const { toUpsert, toDelete } = reconcileGrants(
      [existing('org_admin')],
      [proposed('org_admin')],
    );
    expect(toUpsert).toHaveLength(0);
    expect(toDelete).toHaveLength(0);
  });

  it('upgrades a downgrade-then-upgrade case', () => {
    // existing repo_admin, API now says org_admin → upsert with new perm
    const { toUpsert } = reconcileGrants([existing('repo_admin')], [proposed('org_admin')]);
    expect(toUpsert[0]!.permissionLevel).toBe('org_admin');
  });

  it('handles multiple installs independently', () => {
    const { toUpsert, toDelete } = reconcileGrants(
      [
        { installationId: 1, permissionLevel: 'org_admin' },
        { installationId: 2, permissionLevel: 'repo_admin' },
      ],
      [
        { installationId: 1, permissionLevel: 'org_admin', source: 'membership_check' },
        { installationId: 3, permissionLevel: 'org_admin', source: 'membership_check' },
      ],
    );
    expect(toUpsert.map((g) => g.installationId)).toEqual([3]); // 1 unchanged, 3 new
    expect(toDelete).toEqual([2]); // no longer confirmed
  });
});
