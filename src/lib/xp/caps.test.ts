import { describe, it, expect } from 'vitest';
import { applyCap, type ActionKind } from './caps';
import { DAILY_CAPS } from './sources';

describe('applyCap', () => {
  it('under cap returns full reward', () => {
    const result = applyCap('comment', 0, 1);
    expect(result.allowed).toBe(true);
    expect(result.xpDelta).toBe(1);
    expect(result.atCap).toBe(false);
  });

  it('exactly at cap allows the final action with full XP', () => {
    const result = applyCap('issue_opened', DAILY_CAPS.ISSUES_OPENED - 1, 2);
    expect(result.allowed).toBe(true);
    expect(result.xpDelta).toBe(2);
    expect(result.atCap).toBe(true);
  });

  it('over cap blocks XP but records action', () => {
    const result = applyCap('issue_opened', DAILY_CAPS.ISSUES_OPENED, 2);
    expect(result.allowed).toBe(false);
    expect(result.xpDelta).toBe(0);
    expect(result.atCap).toBe(true);
  });

  it('comments hard cap', () => {
    const result = applyCap('comment', DAILY_CAPS.COMMENTS, 1);
    expect(result.allowed).toBe(false);
  });

  it('reviews hard cap', () => {
    const result = applyCap('review', DAILY_CAPS.REVIEWS, 20);
    expect(result.allowed).toBe(false);
  });

  it('unknown action falls through with no cap', () => {
    const result = applyCap('unknown' as ActionKind, 999, 5);
    expect(result.allowed).toBe(true);
    expect(result.xpDelta).toBe(5);
  });
});
