import { DAILY_CAPS } from './sources';

export type ActionKind = 'issue_opened' | 'comment' | 'pr_opened' | 'review';

const CAP_BY_ACTION: Record<ActionKind, number | undefined> = {
  issue_opened: DAILY_CAPS.ISSUES_OPENED,
  comment: DAILY_CAPS.COMMENTS,
  pr_opened: DAILY_CAPS.PRS_OPENED,
  review: DAILY_CAPS.REVIEWS,
};

export type CapResult = {
  allowed: boolean;
  xpDelta: number;
  atCap: boolean;
};

/**
 * Pure cap check. The caller is responsible for incrementing usage atomically;
 * this function only decides whether the next action gets credit.
 */
export function applyCap(action: ActionKind, currentCount: number, intendedXp: number): CapResult {
  const cap = CAP_BY_ACTION[action];
  if (cap == null) {
    return { allowed: true, xpDelta: intendedXp, atCap: false };
  }
  if (currentCount >= cap) {
    return { allowed: false, xpDelta: 0, atCap: true };
  }
  return {
    allowed: true,
    xpDelta: intendedXp,
    atCap: currentCount + 1 >= cap,
  };
}
