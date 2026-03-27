// Mock Contributors Data
export const mockContributors = [
  {
    id: "c001",
    username: "soumyasagar",
    name: "Soumya Sagar",
    avatar: "SS",
    level: 3,
    skillLevel: "INTERMEDIATE" as const,
    xp: 420,
    xpToNext: 580,
    streak: 7,
    longestStreak: 14,
    issuesSolved: 12,
    prsmerged: 9,
    languages: ["TypeScript", "React", "CSS", "Node.js"],
    joinedAt: "2024-09-01",
    bio: "Building cool things with React & TypeScript. Open source enthusiast.",
    github: "soumyasagar",
    contributions: [
      { repo: "vercel/next.js", title: "Fix hydration mismatch in App Router", merged: "2024-12-10", xp: 150, difficulty: "medium" },
      { repo: "tailwindlabs/tailwindcss", title: "Add missing TypeScript types for v4 config", merged: "2024-11-28", xp: 150, difficulty: "medium" },
      { repo: "shadcn-ui/ui", title: "Fix focus ring visibility in dark mode", merged: "2024-11-15", xp: 50, difficulty: "easy" },
      { repo: "pmndrs/zustand", title: "Update README examples to TypeScript", merged: "2024-10-22", xp: 50, difficulty: "easy" },
    ],
    achievements: ["first_contribution", "bug_hunter", "streak_master"],
  },
];

export const currentUser = mockContributors[0];
