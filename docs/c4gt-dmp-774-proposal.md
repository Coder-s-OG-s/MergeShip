# C4GT DMP Proposal Draft - MergeShip Identity Foundation Hardening

## Project Title

Production-ready Identity Foundation for MergeShip (Extending MVP-1 Auth Baseline)

## Related Links

- Primary context issue: [Code4GovTech/C4GT#774](https://github.com/Code4GovTech/C4GT/issues/774)
- Working issue: [Coder-s-OG-s/MergeShip#1](https://github.com/Coder-s-OG-s/MergeShip/issues/1)
- Current implementation PR: `feat/mvp1-github-oauth-profile-bootstrap`

## Problem Statement

MergeShip has an initial OAuth-based authentication baseline, but the current identity flow needs hardening before mentorship levels, gamification, and triage workflows can reliably build on top of it.

Current gaps:

- API contract ambiguity between profile read and profile initialization.
- Risk of inconsistent profile derivation when username/avatar logic is duplicated.
- Error handling does not always distinguish between authentication and server failures.
- Profile persistence currently uses Appwrite `user.prefs`, which is acceptable for MVP but not ideal for long-term schema growth and queryability.

Without addressing these, downstream modules (XP, levels, maintainer triage, contributor analytics) will accumulate technical debt and inconsistent identity records.

## Goals

1. Establish clear and standards-compliant identity API contracts.
2. Centralize profile derivation logic in backend as the single source of truth.
3. Introduce robust, observable error handling for auth and server paths.
4. Define and begin a safe migration path from `user.prefs` to a dedicated profile collection.
5. Keep scope incremental and mergeable for DMP cadence.

## Non-goals (Explicit Scope Boundaries)

- Level scoring engine.
- XP/badge computation.
- Maintainer queue balancing and triage automation.
- Large UI redesigns.

## Proposed Approach

### Phase 1 - Contract and behavior hardening

- Keep `GET /api/me` read-only and side-effect free.
- Keep profile initialization/update in explicit write endpoint (`POST /api/me`).
- Return structured response payload for profile bootstrap status.

### Phase 2 - Backend identity normalization

- Create a reusable backend resolver to derive:
  - `github_id`
  - canonical `username`
  - `avatar_url`
  - `joined_at`
  - `default_level`
- Ensure onboarding/dashboard/profile consume the same backend-derived identity.

### Phase 3 - Error model and observability

- Differentiate errors by class:
  - `401` for missing/invalid session
  - `4xx` for client misuse/validation failures
  - `5xx` for Appwrite/network/internal failures
- Add contextual logging in critical auth/profile paths.

### Phase 4 - Data model evolution

- Design Appwrite `contributors` collection schema.
- Add compatibility strategy:
  - read from collection if exists
  - fallback to `prefs`
  - optional backfill script for migration
- Document migration and rollout strategy.

## Deliverables

1. Hardened auth/profile API with clear `GET`/`POST` semantics.
2. Centralized backend identity resolver module.
3. Structured error handling and logging strategy.
4. Collection schema design + migration notes (`prefs` to collection).
5. Updated docs:
   - setup/environment
   - API contracts
   - troubleshooting and expected error codes
6. Test coverage:
   - auth/no-session path
   - first bootstrap
   - repeated bootstrap idempotency
   - profile fetch consistency

## Implementation Details

- Stack: Next.js App Router + Appwrite (OAuth/session/account) + TypeScript.
- Keep bootstrap idempotent to prevent duplicate writes.
- Avoid profile derivation in frontend; frontend consumes server profile.
- Add typed response objects for API consumers to reduce client ambiguity.

## Acceptance Criteria

- `GET /api/me` performs no writes.
- `POST /api/me` bootstraps profile for authenticated users and is idempotent.
- Unauthenticated access returns `401` consistently.
- Unexpected server failures return `5xx` with logged context.
- Onboarding/profile page show consistent user identity data.
- Migration plan to dedicated collection is documented and technically validated.

## Validation Plan

- Build validation: `npm run build`
- API checks:
  - Unauthenticated `GET /api/me` -> `401`
  - Authenticated first `POST /api/me` -> profile created
  - Subsequent `POST /api/me` -> no inconsistent mutations
  - Authenticated `GET /api/me` -> stable profile payload
- Manual smoke test:
  - OAuth sign-in
  - onboarding bootstrap
  - profile page render

## Risks and Mitigation

- Appwrite identity fields vary across providers:
  - Mitigation: robust fallback chain, centralized resolver, structured logs.
- Migration complexity from `prefs`:
  - Mitigation: dual-read strategy and phased rollout.
- Session/cookie handling edge cases:
  - Mitigation: explicit 401 boundaries and integration tests.

## Timeline (4 Weeks)

- Week 1: Contract freeze, resolver design, error model draft.
- Week 2: Implement hardened endpoints and centralized resolver.
- Week 3: Collection schema + compatibility layer + migration notes.
- Week 4: Test hardening, docs, review iterations, and handover.

## Contribution Value for DMP

This work lays the identity backbone needed for all subsequent MergeShip modules in the DMP roadmap. It reduces architectural risk early, improves maintainability, and makes feature velocity faster for mentorship, gamification, and maintainer operations.

---

## Ready-to-paste Replies for Current PR Bot Comments

### Reply: unreliable `providerEmail` username derivation

Implemented. Username derivation is now centralized in backend profile resolution and no longer depends on splitting `providerEmail`. The endpoint uses a safer fallback chain and returns normalized profile data for frontend consumers.

### Reply: swallowed error in identity lookup `catch {}`

Implemented. Identity lookup catch now logs contextual errors (`console.error`) so failures are observable without breaking bootstrap flow.

### Reply: top-level generic `401` for all errors

Implemented. Unauthorized responses (`401`) are only returned for missing session cases. Unexpected failures now log server-side errors and return `500` responses with explicit error messages.

### Reply: GET side-effects architectural concern

Implemented. Profile mutation logic has been moved to `POST /api/me`. `GET /api/me` is now read-only and side-effect free.

### Reply: `user.prefs` scalability concern

Acknowledged. Current PR keeps `prefs` to preserve MVP scope and backward compatibility. Next milestone includes introducing a dedicated profile collection with a phased migration plan (dual-read and backfill strategy).

### Reply: duplicated identity logic between backend and onboarding

Implemented. Onboarding now consumes backend profile data from `/api/me` instead of duplicating identity derivation in the client.
