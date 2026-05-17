import type { Difficulty } from './score';
import { RECOMMENDATION_PENALTIES } from './constants';

/**
 * Recommendation pipeline — pure ranking + filtering logic.
 * The async fetch + persist orchestration lives in the server action
 * (src/app/actions/recommendations.ts).
 */

export type ScoredIssue = {
  id: number;
  repoFullName: string;
  number: number;
  title: string;
  difficulty: Difficulty;
  xpReward: number;
  repoHealthScore: number;
  freshnessHours: number;
  languageMatch: boolean;
  repoLanguage: string | null;
};

export type SkipCounts = {
  byRepo: Record<string, number>;
  byLanguage: Record<string, number>;
};

export type RecommendOptions = {
  level: number;
  excludeIssueIds: Set<number>;
  allowFallback?: boolean;
  mutedRepos?: readonly string[];
  mutedLanguages?: readonly string[];
  skipCounts?: SkipCounts;
};

export type LevelMix = { E: number; M: number; H: number };

const MIN_REPO_HEALTH = 40;

export function mixForLevel(level: number): LevelMix {
  if (level <= 0) return { E: 3, M: 0, H: 0 };
  if (level === 1) return { E: 2, M: 2, H: 0 };
  if (level === 2) return { E: 1, M: 2, H: 2 };
  if (level === 3) return { E: 0, M: 2, H: 3 };
  return { E: 0, M: 1, H: 4 };
}

function rankScore(issue: ScoredIssue, opts: RecommendOptions): number {
  const baseline =
    issue.repoHealthScore * 1 +
    (issue.languageMatch ? 20 : 0) +
    Math.max(0, 30 - issue.freshnessHours / 24);

  let penalty = 0;

  const {
    REPO_SKIP_THRESHOLD,
    REPO_SKIP_PENALTY,
    LANGUAGE_SKIP_THRESHOLD,
    LANGUAGE_SKIP_PENALTY,
    MUTED_REPO_PENALTY,
    MUTED_LANGUAGE_PENALTY,
  } = RECOMMENDATION_PENALTIES;

  // Skip-history penalties (from aggregated counts).
  if (opts.skipCounts) {
    const repoSkips = opts.skipCounts.byRepo[issue.repoFullName] ?? 0;
    if (repoSkips >= REPO_SKIP_THRESHOLD) {
      penalty += REPO_SKIP_PENALTY;
    }

    if (issue.repoLanguage) {
      const langSkips = opts.skipCounts.byLanguage[issue.repoLanguage] ?? 0;
      if (langSkips >= LANGUAGE_SKIP_THRESHOLD) {
        penalty += LANGUAGE_SKIP_PENALTY;
      }
    }
  }

  // Mute-preference penalties (explicit user preference).
  if (opts.mutedRepos?.includes(issue.repoFullName)) {
    penalty += MUTED_REPO_PENALTY;
  }
  if (issue.repoLanguage && opts.mutedLanguages?.includes(issue.repoLanguage)) {
    penalty += MUTED_LANGUAGE_PENALTY;
  }

  return baseline - penalty;
}

export function filterAndRank(pool: readonly ScoredIssue[], opts: RecommendOptions): ScoredIssue[] {
  const eligible = pool.filter(
    (i) => i.repoHealthScore >= MIN_REPO_HEALTH && !opts.excludeIssueIds.has(i.id),
  );

  const mix = mixForLevel(opts.level);
  const result: ScoredIssue[] = [];

  for (const tier of ['E', 'M', 'H'] as const) {
    const want = mix[tier];
    if (want === 0) continue;
    const sorted = eligible
      .filter((i) => i.difficulty === tier)
      .sort((a, b) => rankScore(b, opts) - rankScore(a, opts));
    result.push(...sorted.slice(0, want));
  }

  // Fallback: if any tier came up empty, optionally borrow from adjacent (only easier).
  if (opts.allowFallback && result.length < totalDesired(mix)) {
    const seen = new Set(result.map((r) => r.id));
    const extras = eligible
      .filter((i) => !seen.has(i.id))
      .sort((a, b) => rankScore(b, opts) - rankScore(a, opts));
    const needed = totalDesired(mix) - result.length;
    result.push(...extras.slice(0, needed));
  }

  return result;
}

function totalDesired(mix: LevelMix): number {
  return mix.E + mix.M + mix.H;
}
