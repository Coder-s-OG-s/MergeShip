/**
 * Maintainer PR queue — pure sort + filter logic.
 *
 * The DB read lives in a server action; this module is the deterministic
 * core that decides "which PR shows where". Pure functions only — keeps
 * unit tests trivial and the ordering rule auditable.
 */

export type PrState = 'open' | 'closed' | 'merged';
export type MentorVerifiedFilter = 'yes' | 'no' | 'either';

export type MaintainerPrRow = {
  id: number;
  repoFullName: string;
  number: number;
  title: string;
  url: string;
  state: PrState;
  draft: boolean;
  authorLogin: string;
  authorUserId: string | null;
  authorLevel: number | null; // null = not on MergeShip
  authorXp: number | null;
  authorMergedPrs: number | null;
  mentorVerified: boolean;
  mentorReviewerHandle: string | null;
  mentorReviewerLevel: number | null;
  githubUpdatedAt: string; // ISO
};

export type QueueFilters = {
  repos?: string[];
  state?: PrState[];
  authorLevel?: number[];
  mentorVerified?: MentorVerifiedFilter;
};

const VALID_STATES: readonly PrState[] = ['open', 'closed', 'merged'];
const VALID_LEVELS = [0, 1, 2, 3, 4, 5] as const;

/**
 * Tier 1 surfaces first. See plan doc for the rationale on the ordering —
 * mentor verification beats raw author level because it's a stronger trust
 * signal (someone with more context has already screened the PR).
 */
export function prTier(row: MaintainerPrRow): number {
  if (row.state !== 'open') return 6;
  if (row.mentorVerified) {
    return (row.authorLevel ?? 0) >= 1 ? 1 : 2;
  }
  if ((row.authorLevel ?? 0) >= 2) return 3;
  if ((row.authorLevel ?? 0) === 1) return 4;
  return 5;
}

export function comparePrRows(a: MaintainerPrRow, b: MaintainerPrRow): number {
  const tierDelta = prTier(a) - prTier(b);
  if (tierDelta !== 0) return tierDelta;
  const at = new Date(a.githubUpdatedAt).getTime();
  const bt = new Date(b.githubUpdatedAt).getTime();
  if (at !== bt) return bt - at;
  return b.id - a.id;
}

/**
 * Defensive parser for filter inputs that may come from URL params or a
 * client form. Drops anything we don't recognise and clamps levels.
 */
export function validateFilters(input: Partial<QueueFilters>): {
  repos: string[];
  state: PrState[];
  authorLevel: number[];
  mentorVerified: MentorVerifiedFilter;
} {
  const repos = Array.isArray(input.repos)
    ? input.repos.filter((r): r is string => typeof r === 'string')
    : [];

  const state = Array.isArray(input.state)
    ? input.state.filter((s): s is PrState => VALID_STATES.includes(s as PrState))
    : [];

  const authorLevel = Array.isArray(input.authorLevel)
    ? input.authorLevel.filter(
        (n): n is number =>
          typeof n === 'number' && (VALID_LEVELS as readonly number[]).includes(n),
      )
    : [];

  const mentorVerified: MentorVerifiedFilter =
    input.mentorVerified === 'yes' || input.mentorVerified === 'no'
      ? input.mentorVerified
      : 'either';

  return { repos, state, authorLevel, mentorVerified };
}
