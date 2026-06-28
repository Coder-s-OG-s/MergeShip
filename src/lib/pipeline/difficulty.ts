export type Difficulty = 'E' | 'M' | 'H';

export function getAllowedDifficulties(level: number): Difficulty[] {
  if (level <= 0) return ['E'];
  if (level === 1) return ['E', 'M'];
  return ['E', 'M', 'H'];
}
