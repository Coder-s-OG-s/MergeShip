/**
 * Foundational course content. 5 modules, each with a short reading + a quiz.
 * Content lives in code so it's diff-reviewable and i18n-able later.
 *
 * Quiz scoring: percentage = correct / total * 100. Pass ≥80%.
 */

export type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explainer?: string;
};

export type CourseModule = {
  slug: string;
  day: number;
  title: string;
  blurb: string;
  body: string; // markdown
  quiz: QuizQuestion[];
};

export const COURSE_MODULES: CourseModule[] = [
  {
    slug: 'what-is-open-source',
    day: 1,
    title: 'What open source actually is',
    blurb: 'Strip the romance. Learn the social contract you are about to enter.',
    body: `Open source is not free labor. It is a set of public agreements:

1. Anyone can read the code.
2. Anyone can use the code, often with attribution.
3. Anyone can suggest changes via a pull request.
4. The maintainers decide what to accept.

Your job as a contributor is to make the maintainer's life easier — not harder. That means reading existing issues, following the contributing guide, and writing changes that are small enough to review.

The number-one reason PRs get closed without merging: the change didn't match what the project wanted, and the author didn't ask first.`,
    quiz: [
      {
        id: 'q1',
        question:
          'A contributor opens a PR with a 2000-line refactor. The maintainer closes it. The most likely reason is:',
        options: [
          'The refactor was bad',
          'The change was not discussed first and is too big to review',
          'The maintainer is unfriendly',
          'GitHub rate limits',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2',
        question: 'Before opening your first PR on a new project, you should:',
        options: [
          'Start coding immediately, ask questions in the PR',
          'Read the CONTRIBUTING file and the existing issues for that area',
          'Open an issue saying "I want to help"',
          'Fork and rewrite the README to make it better',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: 'github-flow',
    day: 2,
    title: 'The GitHub flow',
    blurb: 'Fork, branch, commit, push, PR. The five verbs that matter.',
    body: `Every contribution follows the same shape:

1. **Fork** the repo to your own account.
2. **Clone** your fork locally.
3. **Branch** off main with a descriptive name (\`fix/empty-list-crash\`).
4. **Commit** in small, focused increments.
5. **Push** the branch to your fork.
6. Open a **pull request** from your branch into the upstream main.

Things that quietly trip people up:

- **Don't commit to main on your fork.** Always branch. Branches make it easy to keep your fork synced.
- **Pull before you push.** \`git pull --rebase upstream main\` before opening the PR avoids messy merges.
- **One PR per problem.** Don't bundle unrelated changes.
`,
    quiz: [
      {
        id: 'q1',
        question: 'After cloning your fork, the first git command you should run is:',
        options: [
          'git push',
          'git checkout -b some-branch-name',
          'git commit -am "start"',
          'git rebase main',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2',
        question: 'A single PR should ideally:',
        options: [
          'Fix as many issues as possible',
          'Be one focused change with a clear summary',
          'Touch every file you noticed needed cleanup',
          'Include only test files',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: 'reading-an-issue',
    day: 3,
    title: 'How to read an issue',
    blurb: 'Half of contributing is figuring out what was actually asked.',
    body: `Most issues are written quickly and miss context. Before you start working:

1. **Read the full thread, not just the first comment.** Often the issue is reframed by the third reply.
2. **Check for an assignee.** If someone is already working on it, ask before duplicating.
3. **Look for a label.** \`good first issue\` / \`help wanted\` mean the maintainer welcomes outside work.
4. **Check the linked PRs.** If a closed PR is linked, someone tried this before — read why it failed.
5. **Reproduce the bug if it's a bug.** "I see this too" is a high-value comment that maintainers love.

When in doubt, comment "I'd like to try this — is the approach in <link> still preferred?" and wait for a thumbs-up before starting.`,
    quiz: [
      {
        id: 'q1',
        question:
          'An issue is labeled "good first issue" but already has someone assigned. You should:',
        options: [
          'Start working on it anyway',
          "Ask the assignee if they're still working on it, otherwise pick another",
          'Comment "stealing this" and open a PR',
          'Open an issue saying you want it',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2',
        question:
          'You find a closed PR linked from the issue. The closed PR was rejected. You should:',
        options: [
          'Ignore it — your code will be different',
          'Read it to understand why the previous approach was rejected before starting',
          'Reopen the closed PR',
          'Email the previous author',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: 'writing-a-pr',
    day: 4,
    title: 'Writing a PR that gets merged',
    blurb: 'A good PR sells itself. Title, summary, screenshot, test plan.',
    body: `A merge-able PR has four things:

1. **Title** in conventional commit form: \`fix: handle empty array in user list\`.
2. **Body summary** — one paragraph: what changed and why.
3. **Test plan** — bullet list of how you verified the change. Even better, automated tests.
4. **Screenshot or recording** — if anything visual changed.

What kills PRs:

- 500-line diffs with no description
- No tests for new logic
- "Fixes everything" PR that touches 30 files
- Bypassing the project's style (lint errors)

Reviewers have limited time. A PR that requires them to guess what you did won't get a thoughtful review.`,
    quiz: [
      {
        id: 'q1',
        question: 'A PR description should always include:',
        options: [
          'A wall of text',
          'A short summary of what + why, plus a test plan',
          'Just the issue link',
          'A link to your portfolio',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2',
        question: 'A reviewer is more likely to merge a PR that:',
        options: [
          'Touches as many files as possible',
          'Is small, focused, and explains how to verify the fix',
          'Has no description because the diff is "self-explanatory"',
          'Skips CI by bypassing lint',
        ],
        correctIndex: 1,
      },
    ],
  },
  {
    slug: 'reviews-and-code-of-conduct',
    day: 5,
    title: 'Reviews + code of conduct',
    blurb: 'How feedback works in OSS, and how to stay welcome long-term.',
    body: `When a reviewer asks for changes, they are not attacking you. They are protecting the project and helping you ship a better version.

How to react well:

- **Thank them and apply the change** if you agree.
- **Push back politely** if you disagree, with a specific reason ("I left this because removing it breaks test X").
- **Don't escalate.** If a review goes nowhere after 2 rounds, ask a different maintainer to weigh in.
- **Squash messy commits** if asked. \`git rebase -i\` is your friend.

Long-term, your reputation in OSS is your contribution profile + how you behave in threads. Future maintainers Google you before merging.

The code of conduct exists because text strips tone. Assume good faith from others, write yours back the way you'd want it read.`,
    quiz: [
      {
        id: 'q1',
        question: 'A reviewer requests a change you disagree with. The best response is:',
        options: [
          'Ignore the comment',
          'Reply politely with a specific reason and wait for their response',
          'Close the PR in frustration',
          'Open a new PR with the same code under a different name',
        ],
        correctIndex: 1,
      },
      {
        id: 'q2',
        question: 'After a heated thread, the best thing for your long-term OSS reputation is:',
        options: [
          'Win the argument at any cost',
          'Take the L if needed, stay polite, your future-self will thank you',
          'Delete your GitHub',
          'Block the reviewer',
        ],
        correctIndex: 1,
      },
    ],
  },
];

export function moduleBySlug(slug: string): CourseModule | undefined {
  return COURSE_MODULES.find((m) => m.slug === slug);
}

export const TOTAL_MODULES = COURSE_MODULES.length;
export const PASS_THRESHOLD = 80;
