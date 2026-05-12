import type { Result } from '../result';
import { xpForMerge } from '../xp/sources';
import type { DifficultyOutput } from '../llm/schemas';

/**
 * Difficulty scoring pipeline. Three stages:
 *   1. Label heuristic — high-confidence shortcuts (good first issue → E etc.)
 *   2. Body/comment heuristic — falls back if labels don't decide
 *   3. LLM (if provided) — only when both heuristics are uncertain
 *
 * The result is cached forever on the issues table (`difficulty`, `difficulty_source`).
 */

export type Difficulty = 'E' | 'M' | 'H';
export type DifficultySource = 'label' | 'heuristic' | 'llm' | 'maintainer';

export type ScoredDifficulty = {
  difficulty: Difficulty;
  confidence: number;
  source: DifficultySource;
  xpReward: number;
};

const LABEL_PATTERNS: { match: RegExp; difficulty: Difficulty; conf: number }[] = [
  {
    match: /\b(good[\s-]?first[\s-]?issue|beginner|first[\s-]?timers?[\s-]?only|easy)\b/i,
    difficulty: 'E',
    conf: 0.95,
  },
  { match: /\b(help[\s-]?wanted|intermediate|enhancement|feature)\b/i, difficulty: 'M', conf: 0.7 },
  { match: /\b(complex|epic|architecture|refactor|major)\b/i, difficulty: 'H', conf: 0.85 },
];

export function scoreDifficultyFromLabels(labels: readonly string[]): {
  difficulty: Difficulty;
  confidence: number;
} {
  for (const pattern of LABEL_PATTERNS) {
    for (const label of labels) {
      if (pattern.match.test(label)) {
        return { difficulty: pattern.difficulty, confidence: pattern.conf };
      }
    }
  }
  return { difficulty: 'M', confidence: 0.3 };
}

function scoreDifficultyFromBody(input: { body?: string; commentCount?: number }): {
  difficulty: Difficulty;
  confidence: number;
} {
  const bodyLen = input.body?.length ?? 0;
  const comments = input.commentCount ?? 0;

  const sizeScore = bodyLen / 500 + comments / 5;
  if (sizeScore >= 6) return { difficulty: 'H', confidence: 0.65 };
  if (sizeScore >= 2) return { difficulty: 'M', confidence: 0.5 };
  return { difficulty: 'E', confidence: 0.55 };
}

type LlmFallback = (issue: ScoreInput) => Promise<Result<DifficultyOutput>>;

export type ScoreInput = {
  title: string;
  body?: string;
  labels: readonly string[];
  commentCount?: number;
};

const LLM_CONFIDENCE_THRESHOLD = 0.6;

export async function scoreDifficulty(
  issue: ScoreInput,
  opts: { llmFallback?: LlmFallback } = {},
): Promise<ScoredDifficulty> {
  const fromLabels = scoreDifficultyFromLabels(issue.labels);
  if (fromLabels.confidence >= LLM_CONFIDENCE_THRESHOLD) {
    return {
      difficulty: fromLabels.difficulty,
      confidence: fromLabels.confidence,
      source: 'label',
      xpReward: xpForMerge(fromLabels.difficulty),
    };
  }

  if (opts.llmFallback) {
    const llmResult = await opts.llmFallback(issue);
    if (llmResult.ok) {
      return {
        difficulty: llmResult.data.difficulty,
        confidence: llmResult.data.confidence,
        source: 'llm',
        xpReward: xpForMerge(llmResult.data.difficulty),
      };
    }
  }

  const fromBody = scoreDifficultyFromBody(issue);
  return {
    difficulty: fromBody.difficulty,
    confidence: fromBody.confidence,
    source: 'heuristic',
    xpReward: xpForMerge(fromBody.difficulty),
  };
}

/**
 * Repo health score 0-100. Used by the recommendation ranker — repos below 40
 * get filtered out as likely abandoned.
 */
export type RepoHealthInput = {
  stars: number;
  recentCommits30d: number;
  recentMergedPrs30d?: number;
  avgIssueResponseDays?: number;
  hasContributingMd: boolean;
  hasLicense: boolean;
};

export function repoHealth(r: RepoHealthInput): number {
  let score = 0;
  if (r.recentCommits30d >= 5) score += 40;
  if ((r.recentMergedPrs30d ?? 0) >= 3) score += 15;
  if ((r.avgIssueResponseDays ?? 999) <= 7) score += 15;
  if (r.hasContributingMd) score += 15;
  if (r.hasLicense) score += 10;
  if (r.stars > 100) score += 5;
  return Math.min(100, score);
}
