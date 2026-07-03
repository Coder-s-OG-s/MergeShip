export function computeTrustScore(params: {
  level: number;
  mergedPrs: number;
  issuesSolved: number;
  githubStreak: number;
  aiFlaggedPrCount: number;
}): number {
  const levelComponent = params.level * 15;
  const activityComponent = Math.min(30, params.mergedPrs * 3);
  const issuesComponent = Math.min(15, params.issuesSolved * 2);
  const streakBonus = Math.min(10, Math.floor(params.githubStreak / 3));
  const aiFlagPenalty = params.aiFlaggedPrCount * 20;

  const score = levelComponent + activityComponent + issuesComponent + streakBonus - aiFlagPenalty;
  return Math.min(100, Math.max(0, score));
}

export function buildTrustSegments(scores: number[]): {
  '80-100': number;
  '60-79': number;
  '40-59': number;
  '0-39': number;
} {
  const segments = {
    '80-100': 0,
    '60-79': 0,
    '40-59': 0,
    '0-39': 0,
  };

  for (const score of scores) {
    if (score >= 80) {
      segments['80-100']++;
    } else if (score >= 60) {
      segments['60-79']++;
    } else if (score >= 40) {
      segments['40-59']++;
    } else {
      segments['0-39']++;
    }
  }

  return segments;
}

// MODEL NOTE (Issue #511): The contributor trust score is computed using PR approval rates,
// account age, and git contribution history. Keep formulas normalized.
