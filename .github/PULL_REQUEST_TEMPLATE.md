## Summary

<!-- A concise description of what this PR does and why. One or two sentences. -->

## Related Issue

Closes #<!-- issue number -->

## Type of Change

- [ ] Bug fix
- [ ] Security fix
- [ ] New feature
- [ ] Refactor (no behaviour change)
- [ ] Performance improvement
- [ ] Tests only
- [ ] Documentation
- [ ] Other

## Root Cause (for bug/security fixes)

<!-- What was wrong and why? Skip if this is a feature or refactor. -->

## What Changed

<!--
List the key changes made. Use bullet points.
Example:
- src/app/api/webhooks/github/route.ts: return generic 500 instead of leaking Supabase error fields
- src/lib/rate-limit.ts: add exponential-backoff retry on Redis connection failure
-->

## Testing

<!--
Describe how you tested the change. Include steps a reviewer can follow to verify the fix locally.
Example:
- Ran npm test -- pass 
- Tested locally via npm run dev
- Verified the failing scenario from the issue no longer reproduces
-->

- [ ] Ran `npm test` locally (all tests pass)
- [ ] Ran `npm run dev` and verified behaviour in the browser
- [ ] Existing tests were not broken by this change

## Screenshots (UI changes only)

<!-- If this PR changes any visual component, attach before/after screenshots. -->

## Security Considerations

<!-- Does this PR touch auth, secrets, session handling, database access, or user-supplied input? If yes, briefly describe the risk surface and why this change is safe. Skip if not applicable. -->

## Checklist

- [ ] My code follows the project structure and conventions
- [ ] No hardcoded secrets, credentials, or internal endpoints
- [ ] No `console.log` debug statements left in production paths
- [ ] I have updated relevant documentation or comments where needed
- [ ] This PR is scoped to a single issue or concern
