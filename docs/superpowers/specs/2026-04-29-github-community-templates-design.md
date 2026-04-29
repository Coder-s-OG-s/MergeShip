---
title: GitHub Community Templates & Contribution Guidelines
date: 2026-04-29
status: approved
---

# GitHub Community Templates & Contribution Guidelines

## Context

MergeShip is participating in C4GT (Code for GovTech) and GirlScript Summer of Code. The repo has no `.github/` directory, no issue templates, no PR template, no contribution guidelines, and no code of conduct. This spec covers creating all of them using GitHub-native features.

## Goals

- Standardize how contributors open issues and PRs
- Enforce an assignment-first workflow (no PR without being assigned to the issue)
- Provide a clear local setup guide for new contributors
- Establish a code of conduct appropriate for a student open-source program

## File Structure

```
.github/
├── ISSUE_TEMPLATE/
│   ├── config.yml
│   ├── bug_report.yml
│   └── feature_request.yml
├── PULL_REQUEST_TEMPLATE.md
CONTRIBUTING.md
CODE_OF_CONDUCT.md
```

## Issue Templates

### `config.yml`
- Disables blank issues entirely (forces contributors through the form)
- Adds a link to GitHub Discussions for general questions

### `bug_report.yml` — fields
- Title (text input)
- Bug description — what happened vs. what was expected (textarea)
- Steps to reproduce (textarea)
- Screenshots (optional textarea)
- Environment: Node version, browser, OS (textarea)

### `feature_request.yml` — fields
- Title (text input)
- Problem this solves (textarea)
- Proposed solution (textarea)
- Alternatives considered (optional textarea)

Both forms include a footer note reminding contributors to request assignment before writing code.

## PR Template (`PULL_REQUEST_TEMPLATE.md`)

Three sections, no trailing checklist bloat:

1. **Linked Issue** — `Closes #` field
2. **What changed and why** — prose description field
3. **Screenshots / Screen recordings** — optional, labelled for UI changes only

Single checkbox: `[ ] I am assigned to the linked issue`

## CONTRIBUTING.md

Sections:
1. **Welcome** — intro mentioning C4GT and GirlScript SoC
2. **Before You Start** — find an open issue → comment to request assignment → wait to be assigned → then write code. No code before assignment.
3. **Setting Up Locally** — clone, `npm install`, `npm run dev`
4. **Making Changes** — branch naming (`fix/issue-123-short-desc`, `feat/issue-123-short-desc`), conventional commits (matching existing repo style)
5. **Opening a PR** — fill the PR template, link the issue, add screenshots for UI changes
6. **Review Process** — what to expect, how to respond to feedback

Style: short, scannable, each section is a heading with 3–5 bullets max.

## CODE_OF_CONDUCT.md

Two-part structure:

**Part 1 — Custom header for C4GT / GirlScript SoC**
- Learning-friendly space
- Maintainers are volunteers — be patient and respectful
- Spam PRs, duplicate issue claims, and gaming contribution counts will result in removal

**Part 2 — Contributor Covenant v2.1 (full text)**
- Expected behavior
- Unacceptable behavior
- Enforcement responsibilities and consequences
- Reporting contact: ayushpatel5615@gmail.com

## Out of Scope

- GitHub Actions to auto-close unassigned PRs (deferred — can be added later)
- CODEOWNERS file (deferred — team structure not yet defined)
- Branch protection rules (infrastructure, not a template concern)
