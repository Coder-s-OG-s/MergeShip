/**
 * Pure helpers for the maintainer issue triage view.
 *
 * Buckets every issue into one of four states the maintainer cares about:
 *   - needs-triage: open, no assignee, no triage labels — first thing to look at
 *   - in-progress:  open, has an assignee or response activity
 *   - stale:        open, untouched for STALE_DAYS — needs a poke or close
 *   - closed:       done, not surfaced by default
 */

export type IssueTriageBucket = 'needs-triage' | 'in-progress' | 'stale' | 'closed';

export type IssueTriageInput = {
  state: 'open' | 'closed';
  assigneeLogin: string | null;
  labels: string[] | null;
  /** Most recent webhook event or fetch (null if we've never been pinged). */
  lastEventAt: Date | null;
  /** When the issue was opened on GitHub. */
  githubCreatedAt: Date | null;
};

export const STALE_DAYS = 30;

// Labels that signal the maintainer has already eyeballed an issue.
// "good first issue" counts because it implies triage happened.
const TRIAGE_LABELS = new Set([
  'good first issue',
  'good-first-issue',
  'help wanted',
  'help-wanted',
  'triaged',
  'confirmed-bug',
  'in-progress',
  'in progress',
]);

export function classifyTriage(input: IssueTriageInput, now: Date = new Date()): IssueTriageBucket {
  if (input.state === 'closed') return 'closed';

  const hasTriageLabel = (input.labels ?? []).some((l) => TRIAGE_LABELS.has(l.toLowerCase()));

  // No assignee + no triage label = nobody has looked at it yet.
  if (!input.assigneeLogin && !hasTriageLabel) return 'needs-triage';

  // Stale check: use lastEventAt if we have it, fall back to createdAt.
  const reference = input.lastEventAt ?? input.githubCreatedAt;
  if (reference) {
    const ageMs = now.getTime() - reference.getTime();
    if (ageMs > STALE_DAYS * 24 * 3600 * 1000) return 'stale';
  }

  return 'in-progress';
}
