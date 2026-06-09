'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import {
  Bell,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  GitBranch,
  Lightbulb,
  Lock,
  PlayCircle,
  ShieldCheck,
  Sparkles,
  Star,
  Trophy,
  Zap,
} from 'lucide-react';

type Module = {
  title: string;
  duration: string;
  xp: number;
  readTime: string;
  intro: string;
  concept: string;
  body: string;
  code: string;
};

type CourseDay = {
  title: string;
  subtitle: string;
  accent: string;
  modules: Module[];
};

const STORAGE_KEY = 'mergeship-learn-progress-v1';
const XP_TO_LEVEL_ONE = 500;

const curriculum: CourseDay[] = [
  {
    title: 'Git & GitHub Fundamentals',
    subtitle:
      'Master the core concepts of version control. By the end of this day, you will comfortably initialize repositories, track changes, and understand the basic flow of Git.',
    accent: 'from-emerald-400/25 via-cyan-400/10 to-transparent',
    modules: [
      {
        title: 'What is Git?',
        duration: '15m',
        xp: 20,
        readTime: '15m',
        intro:
          'Git is a distributed version control system. Imagine it as a highly detailed time machine for your codebase. It does not just save files; it takes snapshots of your entire project at specific points in time.',
        concept:
          'Git tracks changes, not just files. When you commit, you are recording what was added, modified, or deleted since the last snapshot.',
        body: 'To start using Git in a project, initialize a repository. This creates a hidden .git folder that stores all tracking data.',
        code: '# Navigate to your project folder\ncd my-awesome-project\n\n# Initialize the Git repository\ngit init',
      },
      {
        title: 'Tracking Changes',
        duration: '20m',
        xp: 25,
        readTime: '20m',
        intro:
          'The working tree, staging area, and repository are the three places your changes move through before becoming permanent history.',
        concept:
          'The staging area lets you choose exactly which changes belong in the next commit.',
        body: 'Use status often. It is the fastest way to understand what Git sees and what is ready to be committed.',
        code: '# See changed files\ngit status\n\n# Stage a specific file\ngit add README.md\n\n# Stage all current changes\ngit add .',
      },
      {
        title: 'Committing History',
        duration: '25m',
        xp: 30,
        readTime: '25m',
        intro:
          'Commits are named snapshots. A strong commit message explains why a change exists, not only what files moved.',
        concept: 'Small, focused commits make review, rollback, and collaboration much easier.',
        body: 'After staging your files, commit them with a clear message that future you and maintainers can scan quickly.',
        code: '# Commit staged changes\ngit commit -m "Add onboarding notes"\n\n# View recent history\ngit log --oneline --decorate -5',
      },
      {
        title: 'Ignoring Files',
        duration: '10m',
        xp: 20,
        readTime: '10m',
        intro:
          'Not every file belongs in source control. Generated builds, secrets, dependency folders, and local machine files should stay out of commits.',
        concept: '.gitignore keeps noisy or sensitive files from entering your project history.',
        body: 'Create a .gitignore file at the project root and add patterns for files Git should ignore.',
        code: '# Common JavaScript ignores\nnode_modules/\n.env.local\n.next/\ndist/\n\n# Check ignored files\ngit status --ignored',
      },
      {
        title: 'Viewing Logs',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro:
          'Git history is a map. Reading it well helps you understand decisions, find regressions, and prepare cleaner pull requests.',
        concept: 'Logs are most useful when you filter them to the question you are asking.',
        body: 'Use compact logs for scanning and file-specific logs when investigating a particular area.',
        code: '# Compact branch history\ngit log --oneline --graph --decorate\n\n# History for one file\ngit log -- src/app/page.tsx',
      },
    ],
  },
  {
    title: 'Branching Strategies',
    subtitle:
      'Practice isolated feature work with branches, switching contexts, and keeping a clean line of development.',
    accent: 'from-lime-400/20 via-emerald-400/10 to-transparent',
    modules: [
      {
        title: 'Create a Branch',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro: 'Branches let you explore a change without disrupting the main project line.',
        concept: 'A branch is a movable pointer to a commit, so creating one is lightweight.',
        body: 'Name branches after the work they contain so teammates can quickly understand intent.',
        code: 'git checkout -b feature/learn-dashboard\n\ngit branch --show-current',
      },
      {
        title: 'Switch Contexts',
        duration: '15m',
        xp: 20,
        readTime: '15m',
        intro:
          'Switching branches lets you move between tasks while Git updates your working tree.',
        concept:
          'Commit or stash work before switching when changes conflict with the target branch.',
        body: 'Use the newer switch command for clearer branch movement.',
        code: 'git switch main\n\ngit switch feature/learn-dashboard',
      },
      {
        title: 'Merge Work',
        duration: '20m',
        xp: 30,
        readTime: '20m',
        intro:
          'Merging combines work from one branch into another while preserving project history.',
        concept: 'Merge from a clean target branch and resolve conflicts with intent.',
        body: 'After merging, run tests before pushing so the integration is verified locally.',
        code: 'git switch main\n\ngit merge feature/learn-dashboard\n\nnpm run test',
      },
      {
        title: 'Rebase Basics',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro: 'Rebasing replays commits on top of a new base, creating a straighter history.',
        concept: 'Rebase private branches freely; be careful rebasing shared branches.',
        body: 'Use rebase to refresh your feature branch before opening a pull request.',
        code: 'git fetch origin\n\ngit rebase origin/main',
      },
      {
        title: 'Clean Up Branches',
        duration: '10m',
        xp: 20,
        readTime: '10m',
        intro: 'Deleting finished branches keeps your workspace readable and reduces mistakes.',
        concept: 'Local and remote branches are separate references.',
        body: 'Delete branches after the work has merged and the remote no longer needs them.',
        code: 'git branch -d feature/learn-dashboard\n\ngit push origin --delete feature/learn-dashboard',
      },
    ],
  },
  {
    title: 'Collaboration & PRs',
    subtitle:
      'Turn local changes into maintainable pull requests with review-ready commits, context, and discussion.',
    accent: 'from-sky-400/20 via-emerald-400/10 to-transparent',
    modules: [
      {
        title: 'Fork and Clone',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro: 'Forking gives you your own copy of a repository so you can contribute safely.',
        concept: 'Your fork is origin; the original project is usually tracked as upstream.',
        body: 'Clone your fork locally and add upstream so you can keep it current.',
        code: 'git clone https://github.com/you/project.git\n\ncd project\n\ngit remote add upstream https://github.com/org/project.git',
      },
      {
        title: 'Sync Upstream',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro: 'Open source projects move quickly. Syncing reduces conflicts before review.',
        concept: 'Fetch first, then merge or rebase the upstream branch you target.',
        body: 'Update your local main before branching for new work.',
        code: 'git fetch upstream\n\ngit switch main\n\ngit merge upstream/main',
      },
      {
        title: 'Open a PR',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro: 'A pull request packages code, context, and review conversation in one place.',
        concept: 'Good PR descriptions explain scope, testing, and any tradeoffs.',
        body: 'Push your branch, then open a PR against the project branch requested by maintainers.',
        code: 'git push -u origin feature/fix-empty-state\n\ngh pr create --fill',
      },
      {
        title: 'Respond to Review',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro:
          'Review is collaboration. Keep responses specific and update code in focused commits.',
        concept: 'Acknowledge feedback even when you choose a different approach.',
        body: 'After changes, push again and leave a short note about what changed.',
        code: 'git add src/app/learn/page.tsx\n\ngit commit -m "Refine learn module states"\n\ngit push',
      },
      {
        title: 'Squash and Merge',
        duration: '15m',
        xp: 30,
        readTime: '15m',
        intro: 'Some projects prefer a clean final history with one commit per PR.',
        concept: 'Follow the repository contribution guide for merge style.',
        body: 'When maintainers ask for cleanup, interactive rebase can combine local commits.',
        code: 'git rebase -i upstream/main\n\ngit push --force-with-lease',
      },
    ],
  },
  {
    title: 'Advanced Workflows',
    subtitle:
      'Use advanced Git tools to inspect bugs, recover work, and move carefully through complex histories.',
    accent: 'from-teal-400/20 via-green-400/10 to-transparent',
    modules: [
      {
        title: 'Stash Work',
        duration: '10m',
        xp: 20,
        readTime: '10m',
        intro: 'Stashing shelves unfinished work so you can switch tasks quickly.',
        concept: 'A stash is temporary. Apply it back as soon as the interruption is handled.',
        body: 'Name stashes when you have more than one active thread of work.',
        code: 'git stash push -m "wip learn layout"\n\ngit stash list\n\ngit stash pop',
      },
      {
        title: 'Cherry Pick',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro: 'Cherry-pick copies one commit from another branch into your current branch.',
        concept: 'Use it for surgical moves, not as a default collaboration model.',
        body: 'Find the commit hash, switch to the target branch, then cherry-pick it.',
        code: 'git log --oneline\n\ngit switch release\n\ngit cherry-pick abc1234',
      },
      {
        title: 'Bisect Bugs',
        duration: '25m',
        xp: 40,
        readTime: '25m',
        intro:
          'Bisect performs a guided binary search through history to find when a bug appeared.',
        concept: 'Reliable test commands make bisect extremely powerful.',
        body: 'Mark known good and bad commits, then test each commit Git checks out.',
        code: 'git bisect start\n\ngit bisect bad\n\ngit bisect good v1.0.0\n\ngit bisect reset',
      },
      {
        title: 'Reflog Recovery',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro: 'Reflog records where your branch tips and HEAD have been locally.',
        concept: 'Reflog can recover commits that no branch currently points to.',
        body: 'Use reflog when a reset, rebase, or checkout moved you away from important work.',
        code: 'git reflog\n\ngit switch -c recover-work HEAD@{2}',
      },
      {
        title: 'Tag Releases',
        duration: '15m',
        xp: 25,
        readTime: '15m',
        intro: 'Tags mark important points in history, commonly releases.',
        concept: 'Annotated tags include metadata and are preferred for releases.',
        body: 'Create tags after tests pass and push them intentionally.',
        code: 'git tag -a v1.2.0 -m "Release v1.2.0"\n\ngit push origin v1.2.0',
      },
    ],
  },
  {
    title: 'Final Project',
    subtitle:
      'Complete a contribution simulation from issue selection to pull request polish and self-review.',
    accent: 'from-emerald-400/20 via-yellow-400/10 to-transparent',
    modules: [
      {
        title: 'Pick an Issue',
        duration: '15m',
        xp: 30,
        readTime: '15m',
        intro: 'A good first issue is scoped, reproducible, and aligned with project needs.',
        concept: 'Read comments before starting so you do not duplicate active work.',
        body: 'Capture acceptance criteria before writing code.',
        code: 'gh issue view 273\n\ngh issue list --label feature --state open',
      },
      {
        title: 'Plan the Change',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro: 'Planning keeps implementation narrow and reviewable.',
        concept: 'The best plan names the files, behavior, and verification path.',
        body: 'Write a short checklist and keep it updated as you work.',
        code: 'git checkout -b feature/interactive-learn-page\n\nnpm run lint',
      },
      {
        title: 'Build the Feature',
        duration: '30m',
        xp: 45,
        readTime: '30m',
        intro: 'Implementation should follow the project architecture and design language.',
        concept: 'Interactive UI needs explicit states for active, locked, and complete paths.',
        body: 'Build in small increments and verify the main workflow after each piece lands.',
        code: 'npm run dev\n\n# Visit the local route\n# http://localhost:3001/learn',
      },
      {
        title: 'Self Review',
        duration: '20m',
        xp: 35,
        readTime: '20m',
        intro: 'Self-review catches rough edges before maintainers spend review time.',
        concept: 'Review from the user journey first, then from the diff.',
        body: 'Check empty states, disabled states, persistence, and responsive layout.',
        code: 'npm run lint\n\nnpm run typecheck\n\nnpm run build',
      },
      {
        title: 'Ship the PR',
        duration: '15m',
        xp: 55,
        readTime: '15m',
        intro: 'A polished PR makes it easy for maintainers to say yes.',
        concept: 'Summary plus tests is the minimum useful review context.',
        body: 'Open the PR with a focused title and clear verification notes.',
        code: 'git status\n\ngit push -u origin feature/interactive-learn-page\n\ngh pr create',
      },
    ],
  },
];

function moduleKey(dayIndex: number, moduleIndex: number) {
  return `${dayIndex}-${moduleIndex}`;
}

function isBrowserStorageAvailable() {
  return typeof window !== 'undefined' && Boolean(window.localStorage);
}

export default function LearnPage() {
  const [activeDayIndex, setActiveDayIndex] = useState(0);
  const [activeModuleIndex, setActiveModuleIndex] = useState(0);
  const [completed, setCompleted] = useState<Record<string, boolean>>({});
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    if (!isBrowserStorageAvailable()) return;

    const saved = window.localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        const parsed = JSON.parse(saved) as {
          completed?: Record<string, boolean>;
          day?: number;
          module?: number;
        };
        const savedDay = Math.min(Math.max(parsed.day ?? 0, 0), curriculum.length - 1);
        const savedModuleCount = curriculum[savedDay]?.modules.length ?? 1;
        setCompleted(parsed.completed ?? {});
        setActiveDayIndex(savedDay);
        setActiveModuleIndex(Math.min(Math.max(parsed.module ?? 0, 0), savedModuleCount - 1));
      } catch {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded || !isBrowserStorageAvailable()) return;

    window.localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        completed,
        day: activeDayIndex,
        module: activeModuleIndex,
      }),
    );
  }, [activeDayIndex, activeModuleIndex, completed, loaded]);

  const totalXp = useMemo(
    () =>
      curriculum.reduce(
        (total, day, dayIndex) =>
          total +
          day.modules.reduce(
            (dayTotal, module, moduleIndex) =>
              dayTotal + (completed[moduleKey(dayIndex, moduleIndex)] ? module.xp : 0),
            0,
          ),
        0,
      ),
    [completed],
  );

  const firstDay = curriculum[0]!;
  const currentDay = curriculum[activeDayIndex] ?? firstDay;
  const currentModule = currentDay.modules[activeModuleIndex] ?? currentDay.modules[0]!;
  const currentKey = moduleKey(activeDayIndex, activeModuleIndex);
  const completedCount = Object.values(completed).filter(Boolean).length;
  const totalModules = curriculum.reduce((sum, day) => sum + day.modules.length, 0);
  const level = Math.floor(totalXp / XP_TO_LEVEL_ONE);
  const xpWithinLevel = totalXp % XP_TO_LEVEL_ONE;
  const profileScore = 24 + Math.floor(totalXp / 10);

  const isDayComplete = (dayIndex: number) =>
    curriculum[dayIndex]?.modules.every(
      (_, moduleIndex) => completed[moduleKey(dayIndex, moduleIndex)],
    ) ?? false;

  const isDayUnlocked = (dayIndex: number) => dayIndex === 0 || isDayComplete(dayIndex - 1);

  const isModuleUnlocked = (dayIndex: number, moduleIndex: number) =>
    isDayUnlocked(dayIndex) &&
    (moduleIndex === 0 || Boolean(completed[moduleKey(dayIndex, moduleIndex - 1)]));

  const selectDay = (dayIndex: number) => {
    if (!isDayUnlocked(dayIndex)) return;
    setActiveDayIndex(dayIndex);
    setActiveModuleIndex(0);
  };

  const selectModule = (moduleIndex: number) => {
    if (!isModuleUnlocked(activeDayIndex, moduleIndex)) return;
    setActiveModuleIndex(moduleIndex);
  };

  const completeModule = () => {
    setCompleted((progress) => ({
      ...progress,
      [currentKey]: true,
    }));

    const nextModuleIndex = activeModuleIndex + 1;
    if (nextModuleIndex < currentDay.modules.length) {
      setActiveModuleIndex(nextModuleIndex);
      return;
    }

    const nextDayIndex = activeDayIndex + 1;
    if (nextDayIndex < curriculum.length) {
      setActiveDayIndex(nextDayIndex);
      setActiveModuleIndex(0);
    }
  };

  const navigateModule = (direction: -1 | 1) => {
    const target = activeModuleIndex + direction;
    if (
      target < 0 ||
      target >= currentDay.modules.length ||
      !isModuleUnlocked(activeDayIndex, target)
    ) {
      return;
    }
    setActiveModuleIndex(target);
  };

  const copyCode = async () => {
    const copyKey = currentKey;
    try {
      await navigator.clipboard.writeText(currentModule.code);
      setCopiedKey(copyKey);
      window.setTimeout(() => setCopiedKey(null), 1400);
    } catch {
      setCopiedKey(null);
    }
  };

  return (
    <main className="min-h-screen bg-[#0D0E12] font-mono text-zinc-100">
      <div
        className="fixed inset-0"
        style={{
          backgroundImage:
            'radial-gradient(circle at 20% 20%, rgba(0,255,135,0.08), transparent 24%), linear-gradient(rgba(0,255,135,0.035) 1px, transparent 1px), linear-gradient(90deg, rgba(0,255,135,0.035) 1px, transparent 1px)',
          backgroundSize: 'auto, 32px 32px, 32px 32px',
        }}
      />
      <div className="relative">
        <header className="sticky top-0 z-30 border-b border-zinc-800/90 bg-[#0D0E12]/90 px-5 py-4 backdrop-blur-xl sm:px-8">
          <div className="flex flex-wrap items-center justify-between gap-5">
            <Link
              href="/"
              className="font-display text-2xl font-black tracking-tight text-[#00FF87]"
            >
              MergeShip
            </Link>

            <nav className="flex items-center gap-7 text-sm font-semibold tracking-widest text-zinc-300">
              <Link href="/" className="transition hover:text-[#00FF87]">
                Home
              </Link>
              <Link href="/learn" className="border-b-2 border-[#00FF87] pb-2 text-[#00FF87]">
                Learn
              </Link>
              <Link href="/issues" className="transition hover:text-[#00FF87]">
                Code
              </Link>
            </nav>

            <div className="flex items-center gap-4">
              <div className="hidden text-right text-xs font-semibold tracking-widest text-zinc-300 sm:block">
                {xpWithinLevel} / {XP_TO_LEVEL_ONE} XP TO L{level + 1}
                <div className="mt-2 h-1.5 w-36 overflow-hidden rounded-full bg-zinc-800">
                  <div
                    className="h-full rounded-full bg-[#00FF87] transition-all duration-500"
                    style={{ width: `${Math.min((xpWithinLevel / XP_TO_LEVEL_ONE) * 100, 100)}%` }}
                  />
                </div>
              </div>
              <Bell className="h-5 w-5 text-zinc-300" />
              <Trophy className="h-5 w-5 text-zinc-300" />
              <div className="flex items-center gap-2 border border-[#00FF87] px-3 py-2 text-xs font-semibold tracking-widest text-[#00FF87] uppercase">
                <Star className="h-4 w-4" />L{level} Newcomer
              </div>
              <img
                src="https://github.com/github.png"
                alt="Profile avatar"
                className="h-10 w-10 rounded-sm border border-[#00FF87]/50 object-cover"
              />
            </div>
          </div>
        </header>

        <section className="grid gap-6 px-5 py-8 sm:px-8 xl:grid-cols-[350px_minmax(0,1fr)_360px]">
          <aside className="space-y-6 xl:sticky xl:top-28 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <Panel className="p-6">
              <div className="flex items-center gap-5">
                <div className="relative">
                  <img
                    src="https://github.com/octocat.png"
                    alt="Contributor avatar"
                    className="h-16 w-16 rounded-md border border-[#00FF87] object-cover"
                  />
                  <span className="absolute -right-1 -bottom-1 h-4 w-4 rounded-full border-2 border-[#0D0E12] bg-[#00FF87]" />
                </div>
                <div>
                  <p className="text-xl text-zinc-100">PROFILE SCORE</p>
                  <p className="text-3xl font-black text-[#00FF87]">{profileScore}</p>
                </div>
              </div>
              <div className="my-6 h-px bg-zinc-700" />
              <div className="grid grid-cols-3 gap-3 text-center text-xs tracking-widest text-zinc-300 uppercase">
                <Stat value={`${totalXp} XP`} />
                <Stat value={`L${level}`} />
                <Stat value={`${Math.floor(completedCount / 3)} PRs`} />
              </div>
            </Panel>

            <Panel className="p-6">
              <h2 className="mb-7 text-sm font-bold tracking-[0.2em] text-zinc-300 uppercase">
                Your Progress
              </h2>
              <div className="space-y-5">
                {curriculum.map((day, dayIndex) => {
                  const unlocked = isDayUnlocked(dayIndex);
                  const complete = isDayComplete(dayIndex);
                  const active = dayIndex === activeDayIndex;

                  return (
                    <button
                      key={day.title}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => selectDay(dayIndex)}
                      className={`group grid w-full grid-cols-[34px_1fr] items-start gap-4 text-left transition ${
                        unlocked ? 'hover:text-[#00FF87]' : 'cursor-not-allowed opacity-45'
                      }`}
                    >
                      <span
                        className={`flex h-8 w-8 items-center justify-center rounded-full border ${
                          complete || active
                            ? 'border-[#00FF87] bg-[#00FF87]/15 text-[#00FF87]'
                            : 'border-zinc-700 bg-zinc-900 text-zinc-500'
                        }`}
                      >
                        {complete ? (
                          <Check className="h-4 w-4" />
                        ) : unlocked ? (
                          <Circle className="h-3 w-3 fill-current" />
                        ) : (
                          <Lock className="h-4 w-4" />
                        )}
                      </span>
                      <span>
                        <span
                          className={`block font-bold ${active ? 'text-[#00FF87]' : 'text-zinc-300'}`}
                        >
                          Day {dayIndex + 1}
                        </span>
                        <span className="block text-sm text-zinc-500">{day.title}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </Panel>

            <Panel className="p-6">
              <h2 className="mb-6 text-sm font-bold tracking-[0.2em] text-zinc-300 uppercase">
                Rewards Today
              </h2>
              <Reward
                label={`Complete Module ${activeModuleIndex + 1}`}
                value={`+${currentModule.xp} XP`}
              />
              <Reward label="Pass Quiz" value="+50 XP" />
              <Reward label={`Day ${activeDayIndex + 1} Completion`} value="+200 XP" />
            </Panel>
          </aside>

          <div className="min-w-0 space-y-6">
            <div className="text-sm font-bold tracking-[0.2em] text-zinc-400 uppercase">
              Course <span className="px-2 text-zinc-600">/</span> Day {activeDayIndex + 1}{' '}
              <span className="px-2 text-zinc-600">/</span>{' '}
              <span className="text-[#00FF87]">Module {activeModuleIndex + 1}</span>
            </div>

            <Panel className="relative overflow-hidden p-8">
              <div
                className={`absolute inset-y-0 right-0 w-1/2 bg-gradient-to-l ${currentDay.accent}`}
              />
              <div className="absolute top-4 right-8 hidden h-48 w-48 rounded-full border-2 border-dashed border-[#00FF87]/25 md:block" />
              <div className="absolute top-10 right-10 hidden h-48 w-48 md:block">
                <div className="absolute top-28 left-10 h-px w-44 rotate-[-45deg] bg-[#00FF87]/30" />
                <div className="absolute top-20 left-20 h-px w-40 bg-[#00FF87]/20" />
                <div className="absolute top-28 left-24 h-6 w-6 rounded-full bg-[#00FF87]/30" />
                <div className="absolute top-8 right-2 h-5 w-5 rounded-full bg-[#00FF87]/25" />
              </div>
              <div className="relative max-w-3xl">
                <div className="mb-6 inline-flex border border-[#00FF87] px-4 py-2 text-sm font-bold tracking-widest text-[#00FF87] uppercase">
                  Day {activeDayIndex + 1} of {curriculum.length}
                </div>
                <h1 className="mb-4 text-2xl font-semibold text-white">{currentDay.title}</h1>
                <p className="text-lg leading-8 text-zinc-300">{currentDay.subtitle}</p>
              </div>
            </Panel>

            <Panel className="p-6 sm:p-8">
              <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
                <div>
                  <h2 className="text-3xl font-semibold text-white">{currentModule.title}</h2>
                  <p className="mt-3 text-sm text-zinc-400">
                    Module {activeModuleIndex + 1} / Estimated Time: {currentModule.readTime}
                  </p>
                </div>
                <span className="bg-[#00FF87] px-4 py-3 text-sm font-bold tracking-widest text-[#0D0E12] uppercase">
                  {completed[currentKey] ? 'Completed' : 'Active'}
                </span>
              </div>

              <div className="space-y-7 text-lg leading-8 text-zinc-200">
                <p>{currentModule.intro}</p>
                <div className="border-l-2 border-yellow-300 bg-zinc-800/90 p-6">
                  <div className="flex gap-5">
                    <Lightbulb className="mt-1 h-6 w-6 shrink-0 text-yellow-300" />
                    <div>
                      <p className="mb-2 text-base font-bold tracking-widest text-yellow-200 uppercase">
                        Key Concept
                      </p>
                      <p className="text-base leading-7 text-zinc-200">{currentModule.concept}</p>
                    </div>
                  </div>
                </div>
                <p>{currentModule.body}</p>
              </div>

              <div className="mt-8 overflow-hidden rounded border border-zinc-700 bg-[#07090B]">
                <div className="flex items-center justify-between border-b border-zinc-700 bg-zinc-800 px-5 py-3 text-sm text-zinc-300">
                  <span>bash</span>
                  <button
                    type="button"
                    onClick={copyCode}
                    className="inline-flex items-center gap-2 rounded border border-transparent px-2 py-1 text-zinc-200 transition hover:border-[#00FF87]/50 hover:text-[#00FF87]"
                    aria-label="Copy code snippet"
                  >
                    <Copy className="h-4 w-4" />
                    <span className="text-xs tracking-widest uppercase">
                      {copiedKey === currentKey ? 'Copied' : 'Copy'}
                    </span>
                  </button>
                </div>
                <pre className="overflow-x-auto p-5 text-base leading-7 text-zinc-200">
                  <code>{currentModule.code}</code>
                </pre>
              </div>

              <div className="mt-10 flex justify-end border-t border-zinc-700 pt-8">
                <button
                  type="button"
                  onClick={completeModule}
                  className="inline-flex w-full items-center justify-center gap-3 bg-[#00FF87] px-6 py-4 text-sm font-black tracking-widest text-[#0D0E12] uppercase transition hover:bg-emerald-300 sm:w-auto"
                >
                  {completed[currentKey] ? 'Module Complete' : 'Complete Module'}
                  <CheckCircle2 className="h-5 w-5" />
                </button>
              </div>
            </Panel>

            <div className="flex flex-wrap items-center justify-between gap-6 py-4">
              <button
                type="button"
                onClick={() => navigateModule(-1)}
                disabled={activeModuleIndex === 0}
                className="inline-flex items-center gap-3 text-sm font-bold tracking-widest text-zinc-400 uppercase transition hover:text-[#00FF87] disabled:cursor-not-allowed disabled:opacity-40"
              >
                <ChevronLeft className="h-6 w-6" />
                Previous
              </button>

              <div className="flex items-center gap-3">
                {currentDay.modules.map((_, moduleIndex) => {
                  const unlocked = isModuleUnlocked(activeDayIndex, moduleIndex);
                  return (
                    <button
                      key={moduleIndex}
                      type="button"
                      disabled={!unlocked}
                      onClick={() => selectModule(moduleIndex)}
                      aria-label={`Open module ${moduleIndex + 1}`}
                      className={`h-3 w-3 rounded-full transition ${
                        moduleIndex === activeModuleIndex
                          ? 'bg-[#00FF87]'
                          : unlocked
                            ? 'bg-zinc-600 hover:bg-[#00FF87]/70'
                            : 'cursor-not-allowed bg-zinc-800'
                      }`}
                    />
                  );
                })}
              </div>

              <button
                type="button"
                onClick={() => navigateModule(1)}
                disabled={
                  activeModuleIndex === currentDay.modules.length - 1 ||
                  !isModuleUnlocked(activeDayIndex, activeModuleIndex + 1)
                }
                className="inline-flex items-center gap-3 text-sm font-bold tracking-widest text-zinc-200 uppercase transition hover:text-[#00FF87] disabled:cursor-not-allowed disabled:opacity-40"
              >
                Next
                <ChevronRight className="h-6 w-6" />
              </button>
            </div>
          </div>

          <aside className="space-y-4 xl:sticky xl:top-28 xl:h-[calc(100vh-8rem)] xl:overflow-y-auto">
            <h2 className="text-sm font-bold tracking-[0.2em] text-zinc-300 uppercase">
              Day {activeDayIndex + 1} Modules
            </h2>
            {currentDay.modules.map((module, moduleIndex) => {
              const unlocked = isModuleUnlocked(activeDayIndex, moduleIndex);
              const complete = Boolean(completed[moduleKey(activeDayIndex, moduleIndex)]);
              const active = moduleIndex === activeModuleIndex;

              return (
                <button
                  key={module.title}
                  type="button"
                  disabled={!unlocked}
                  onClick={() => selectModule(moduleIndex)}
                  className={`w-full border p-5 text-left transition ${
                    active
                      ? 'border-[#00FF87] bg-[#00FF87]/10 shadow-[0_0_22px_rgba(0,255,135,0.12)]'
                      : unlocked
                        ? 'border-zinc-800 bg-zinc-950/40 hover:border-[#00FF87]/50 hover:bg-[#00FF87]/5'
                        : 'cursor-not-allowed border-zinc-800 bg-zinc-950/30 opacity-45'
                  }`}
                >
                  <div className="mb-4 flex items-start justify-between gap-4">
                    <div>
                      <p className="mb-3 text-xs font-bold tracking-widest text-[#00FF87] uppercase">
                        Module {moduleIndex + 1}
                      </p>
                      <h3 className="text-lg font-semibold text-zinc-100">{module.title}</h3>
                    </div>
                    {complete ? (
                      <ShieldCheck className="h-5 w-5 text-[#00FF87]" />
                    ) : active ? (
                      <PlayCircle className="h-5 w-5 text-[#00FF87]" />
                    ) : unlocked ? (
                      <GitBranch className="h-5 w-5 text-zinc-400" />
                    ) : (
                      <Lock className="h-5 w-5 text-zinc-500" />
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-sm text-zinc-400">
                    <Clock3 className="h-4 w-4" />
                    {module.duration}
                    <span className="ml-auto text-[#00FF87]">+{module.xp} XP</span>
                  </div>
                </button>
              );
            })}
          </aside>
        </section>

        <div className="fixed right-6 bottom-6 z-40 border border-[#00FF87] bg-[#0D0E12] px-5 py-4 shadow-[0_0_30px_rgba(0,255,135,0.18)]">
          <div className="flex items-center gap-4">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[#00FF87]/15 text-[#00FF87]">
              <Zap className="h-6 w-6" />
            </span>
            <div>
              <p className="text-sm text-zinc-200">Daily Login Bonus</p>
              <p className="font-bold tracking-widest text-[#00FF87]">+20 XP Earned</p>
            </div>
          </div>
        </div>

        <div className="fixed bottom-6 left-6 hidden items-center gap-2 rounded-full border border-zinc-800 bg-zinc-950/80 px-4 py-2 text-xs text-zinc-400 backdrop-blur md:flex">
          <Sparkles className="h-4 w-4 text-[#00FF87]" />
          {completedCount} / {totalModules} modules complete
        </div>
      </div>
    </main>
  );
}

function Panel({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return (
    <div
      className={`border border-zinc-800 bg-zinc-950/55 shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] backdrop-blur ${className}`}
    >
      {children}
    </div>
  );
}

function Stat({ value }: { value: string }) {
  return (
    <div className="border border-zinc-700 bg-zinc-800/50 px-3 py-3 text-zinc-200">{value}</div>
  );
}

function Reward({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between border-b border-zinc-800 py-4 last:border-b-0">
      <span className="text-sm text-zinc-200">{label}</span>
      <span className="text-sm font-bold text-[#00FF87]">{value}</span>
    </div>
  );
}
