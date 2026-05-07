export interface ContributorProfile {
  github_id: string | null;
  github_handle: string | null;
  username: string;
  avatar_url: string;
  joined_at: string;
  default_level: "L1";
}

export interface BaseIssue {
  id: string;
  repo: string;
  repoOwner: string;
  title: string;
  difficulty: "EASY" | "MEDIUM" | "HARD";
  labels: string[];
  estimatedTime: string;
  xpReward: number;
  highlightText?: string;
  highlightType?: "star" | "contribution" | "comment";
}

export interface AchievementBadge {
  id: string;
  name: string;
  icon: string;
  description: string;
  isLocked: boolean;
  color?: string;
}

export interface UserStats {
  level: string;
  levelProgress: number;
  totalXp: number;
  weeklyXp: number;
  streak: number;
  badgesCount: number;
  streakRecord: number;
}
