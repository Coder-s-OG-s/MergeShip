/**
 * Pure helpers for the mentor verification PR comment flow.
 * The Inngest function (inngest/functions/mentor-post-comment) does the
 * GitHub call; this file just decides what to do and what to say.
 */

export type MentorCommentContext = {
  isDraft: boolean;
  state: 'open' | 'closed' | 'merged';
  existingCommentId: number | null;
  existingMentorLevel: number | null;
  newMentorLevel: number;
};

export type MentorCommentAction = 'post' | 'update' | 'skip';

/**
 * Should we post a fresh comment, edit the existing one, or do nothing?
 *
 * - Draft / closed / merged → skip (no point notifying)
 * - No existing comment → post
 * - Existing comment + new reviewer outranks → update
 * - Same or lower level → skip (never downgrade)
 * - Existing mentor level recorded but no comment id (pre-feature rows) → post
 */
export function decideMentorCommentAction(ctx: MentorCommentContext): MentorCommentAction {
  if (ctx.isDraft) return 'skip';
  if (ctx.state === 'closed' || ctx.state === 'merged') return 'skip';

  if (ctx.existingCommentId === null) return 'post';

  if (ctx.existingMentorLevel !== null && ctx.newMentorLevel <= ctx.existingMentorLevel) {
    return 'skip';
  }
  return 'update';
}

export function buildMentorCommentBody(input: {
  reviewerHandle: string;
  reviewerLevel: number;
}): string {
  return `Reviewed by MergeShip mentor @${input.reviewerHandle} (L${input.reviewerLevel}). Mentor-verified PRs have already had a peer review pass.`;
}
