/**
 * Anti-abuse rule from the docs: "self-actions on own repo don't count".
 * A user never earns merge XP (and never claims work) in a repository they
 * own, regardless of whether the merge was recommended or not.
 *
 * Shared by handleMerge and the claim actions so the two layers cannot drift.
 */
export function isSelfMerge(repoFullName: string, githubLogin: string): boolean {
  const slash = repoFullName.indexOf('/');
  if (slash <= 0 || !githubLogin) return false;
  return repoFullName.slice(0, slash).toLowerCase() === githubLogin.toLowerCase();
}
