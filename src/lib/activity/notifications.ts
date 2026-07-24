export type ActivityDetail = Record<string, unknown> | null;

/**
 * Human-readable message for an activity_log row, keyed by `kind`.
 * Mirrors the exact detail shapes written by each Inngest function / action:
 *   - claim                 { issueId } | { recId }        (issues.ts / recommendations.ts)
 *   - help_dispatch          { helpRequestId }              (help-dispatch.ts)
 *   - mentor_comment_posted  { prId, commentId, repo, number, updated? }  (mentor-post-comment.ts)
 *   - mentor_comment_error   { prId, error }                (mentor-post-comment.ts)
 *   - mentor_auto_assigned   { prUrl, prTitle, repo, prNumber, authorLogin } (mentor-assigned-notify.ts)
 *   - pr_merged              { recId, repo, prNumber, xpAwarded } (process-pr-event.ts)
 *   - claim_reset_stale      { recId }                      (maintenance.ts)
 *   - claim_warning_stale    { recId, daysClaimed }          (maintenance.ts)
 */
export function notificationMessage(kind: string, detail: ActivityDetail): string {
  const d = (detail ?? {}) as Record<string, unknown>;

  switch (kind) {
    case 'claim':
      return 'You claimed an issue';
    case 'help_dispatch':
      return 'A contributor requested your help reviewing a PR';
    case 'mentor_comment_posted':
      return typeof d.repo === 'string' && typeof d.number === 'number'
        ? `Mentor feedback posted on ${d.repo} #${d.number}`
        : 'Mentor feedback posted on your PR';
    case 'mentor_comment_error':
      return "MergeShip couldn't post mentor feedback on your PR";
    case 'mentor_auto_assigned':
      return typeof d.prTitle === 'string'
        ? `You were assigned as mentor for "${d.prTitle}"`
        : 'You were assigned as a mentor';
    case 'pr_merged': {
      const xp = typeof d.xpAwarded === 'number' ? ` (+${d.xpAwarded} XP)` : '';
      return typeof d.repo === 'string'
        ? `Your PR merged in ${d.repo}${xp}`
        : `Your PR was merged${xp}`;
    }
    case 'claim_reset_stale':
      return 'Your claim was reset due to inactivity';
    case 'claim_warning_stale':
      return typeof d.daysClaimed === 'number'
        ? `Your claim is ${d.daysClaimed} days old \u2014 act soon or it may be reset`
        : 'Your claim is at risk of being reset';
    default:
      return kind.replace(/_/g, ' ');
  }
}

/** External link for a notification, when the detail contains enough to build one. */
export function notificationLink(kind: string, detail: ActivityDetail): string | null {
  const d = (detail ?? {}) as Record<string, unknown>;

  if (typeof d.prUrl === 'string') return d.prUrl;

  const repo = typeof d.repo === 'string' ? d.repo : null;
  const number =
    typeof d.number === 'number' ? d.number : typeof d.prNumber === 'number' ? d.prNumber : null;

  if (repo && number) return `https://github.com/${repo}/pull/${number}`;
  return null;
}
