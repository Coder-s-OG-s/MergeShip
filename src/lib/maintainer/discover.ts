/**
 * Pure helpers for the maintainer-discover flow. The Inngest function
 * fetches GitHub API responses and persists rows; this file translates
 * those responses into "should this user have a grant on this install?"
 * decisions and reconciles them with existing junction state.
 *
 * Pure functions only — keeps the discovery decision auditable and
 * trivial to unit test.
 */

export type PermissionLevel = 'org_admin' | 'repo_admin' | 'repo_maintain';

export type OrgMembership = { role: 'admin' | 'member' | string; state: 'active' | 'pending' };

export type ExistingGrant = {
  installationId: number;
  permissionLevel: PermissionLevel;
};

export type ProposedGrant = {
  installationId: number;
  permissionLevel: PermissionLevel;
  source: 'membership_check' | 'install_creator' | 'manual_invite';
};

/**
 * GitHub returns role='admin' for org admins. Only active admins get
 * a grant — pending invitations don't count.
 */
export function decideOrgGrant(m: OrgMembership | null): PermissionLevel | null {
  if (!m) return null;
  if (m.state !== 'active') return null;
  if (m.role === 'admin') return 'org_admin';
  return null;
}

/**
 * GitHub returns a permission string from getCollaboratorPermissionLevel.
 * We only treat admin / maintain as maintainer-level access.
 */
export function decideRepoGrant(permission: string): PermissionLevel | null {
  if (permission === 'admin') return 'repo_admin';
  if (permission === 'maintain') return 'repo_maintain';
  return null;
}

/**
 * Compare existing junction rows with the freshly-computed proposed grants
 * and return what to upsert vs delete. No churn on unchanged rows.
 */
export function reconcileGrants(
  existing: readonly ExistingGrant[],
  proposed: readonly ProposedGrant[],
): { toUpsert: ProposedGrant[]; toDelete: number[] } {
  const existingMap = new Map<number, ExistingGrant>();
  for (const g of existing) existingMap.set(g.installationId, g);

  const proposedMap = new Map<number, ProposedGrant>();
  for (const g of proposed) proposedMap.set(g.installationId, g);

  const toUpsert: ProposedGrant[] = [];
  for (const [id, prop] of proposedMap) {
    const ex = existingMap.get(id);
    if (!ex || ex.permissionLevel !== prop.permissionLevel) {
      toUpsert.push(prop);
    }
  }

  const toDelete: number[] = [];
  for (const id of existingMap.keys()) {
    if (!proposedMap.has(id)) toDelete.push(id);
  }

  return { toUpsert, toDelete };
}
