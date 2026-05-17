/**
 * Recommendation ranking constants.
 *
 * All scoring penalties applied during filterAndRank() are defined here.
 * Adjust these to tune ranking quality without touching ranking logic.
 *
 * Penalty design principles:
 *  - Penalties are SUBTRACTIVE — they reduce a candidate's rank score.
 *  - They are DOWN-RANKING only: no candidate is hard-excluded by penalty alone.
 *  - Muted penalties are stronger than skip-history penalties.
 *  - Language skip penalties are softer than repo skip penalties to preserve diversity.
 *  - Stack predictably: a muted+skipped repo simply accumulates both penalties.
 */

export const RECOMMENDATION_PENALTIES = {
  /**
   * Number of times a user must have skipped recs from the same repo
   * before the repo-skip penalty kicks in.
   */
  REPO_SKIP_THRESHOLD: 2,

  /**
   * Score reduction applied to each issue from a repository the user
   * has skipped >= REPO_SKIP_THRESHOLD times.
   * Conservative: keeps the repo surfaceable but pushes it down the list.
   */
  REPO_SKIP_PENALTY: 15,

  /**
   * Number of skipped recs whose primary language matches a language
   * before the language-skip penalty kicks in.
   */
  LANGUAGE_SKIP_THRESHOLD: 3,

  /**
   * Score reduction applied to issues whose repo_language has been
   * skipped >= LANGUAGE_SKIP_THRESHOLD times.
   * Softer than repo penalty to preserve cross-language diversity.
   */
  LANGUAGE_SKIP_PENALTY: 10,

  /**
   * Score reduction for repos the user has explicitly muted ("not interested").
   * Large enough to push muted repos near the bottom without disappearing them,
   * so they can resurface if the candidate pool is thin.
   */
  MUTED_REPO_PENALTY: 50,

  /**
   * Score reduction for issues whose language the user has explicitly muted.
   * Smaller than MUTED_REPO_PENALTY to allow some diversity bleed-through.
   */
  MUTED_LANGUAGE_PENALTY: 30,
} as const;

/** How many days of skip history to consider when computing skip penalties. */
export const SKIP_HISTORY_WINDOW_DAYS = 30;
