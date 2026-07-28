# Promotion Eligibility Banner — Design Spec

**Issue:** #451
**Date:** 2026-06-30
**Status:** Approved

---

## Summary

Add a banner to the maintainer dashboard showing contributors who are within 10% of their next XP level threshold. Leveling is fully automatic — this is a nudge, not a manual approval gate. "Review profile" is pure navigation to `/@handle`.

---

## Context

- XP thresholds (from `src/lib/xp/curve.ts`): L0=0, L1=100, L2=459, L3=1119, L4=2089, L5=3404
- `profiles.xp` and `profiles.level` are authoritative cached values — no need to re-sum `xp_events`
- MAX_LEVEL = 5; contributors at L5 are excluded (no next level)
- Contributors are scoped to an installation via their XP events in that install's repos

---

## Eligibility Threshold

A contributor is eligible when:

```
xp >= xpForLevel(level + 1) - (xpForLevel(level + 1) - xpForLevel(level)) * 0.1
```

This is a relative 10% of the level gap, which scales correctly across all transitions (L0→L1 gap is 100 XP; L4→L5 gap is 1,315 XP).

---

## Data Layer

### New type (`src/app/actions/maintainer/types.ts`)

```ts
export type PromotionEligibleRow = {
  githubHandle: string;
  xp: number;
  level: number;
  xpNeeded: number; // XP remaining to reach next level
};
```

### New server action `getPromotionEligible` (`src/app/actions/maintainer/analytics.ts`)

- Auth: `requireMaintainer()` with `RATE_LIMIT_TIERS.STANDARD`
- Repo scoping: `listMaintainerRepos(user.id, installationId)` → repo list
- Step 1: query `xpEvents` grouped by `userId` where `repo IN repos` → get distinct contributor user IDs
- Step 2: query `profiles` by those IDs, reading `xp` and `level` directly (not re-summing events)
- Step 3: filter in TypeScript using `xpForLevel` from `curve.ts`; exclude level >= MAX_LEVEL
- Return up to 10 rows, ordered by `xpNeeded ASC` (closest to leveling up first)
- Export from `src/app/actions/maintainer/index.ts`

---

## UI

### Placement

In `src/app/(app)/maintainer/page.tsx`, rendered **above** the "Suspicious XP Signals" section (most actionable first). Only renders when the list is non-empty.

### Visual design

- Border/background: `border-emerald-900/60 bg-emerald-950/20` — distinct from amber fraud alerts
- Header row: title "Promotion Eligible", count badge, subtitle "These contributors are within 10% of their next level."
- Each row: `@handle`, level badge (`L{n}`), current XP, "X XP to L{next}" in muted text, `Review profile →` link to `/@{handle}`
- No interactive server actions — navigation only

### Mockup

```
┌─────────────────────────────────────────────────────────┐
│ ★ Promotion Eligible          [3 contributors]          │
│ These contributors are within 10% of their next level.  │
│                                                         │
│  @dev.meera    L2 · 412 XP   47 XP to L3  Review →    │
│  @axolotl5165  L1 · 88 XP    12 XP to L2  Review →    │
└─────────────────────────────────────────────────────────┘
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/app/actions/maintainer/types.ts` | Add `PromotionEligibleRow` type |
| `src/app/actions/maintainer/analytics.ts` | Add `getPromotionEligible` server action |
| `src/app/actions/maintainer/index.ts` | Export `getPromotionEligible` |
| `src/app/(app)/maintainer/page.tsx` | Fetch result + render banner section |

No migrations needed.

---

## Out of Scope

- Manual approval/promotion UI (leveling is automatic)
- Dismissing individual alerts
- Email/notification on eligibility
