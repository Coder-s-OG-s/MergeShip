export type Difficulty = 'E' | 'M' | 'H';

export function getAllowedDifficulties(level: number): Difficulty[] {
  if (level <= 0) return ['E'];
  if (level === 1) return ['E', 'M'];
  return ['E', 'M', 'H'];
}

/**
 * Clamps a difficulty to the hardest tier the level is allowed to see.
 *
 * Needed wherever an existing difficulty is used to seed a new pick: a stored
 * difficulty is not guaranteed to be within the owner's cap, because issues
 * claimed directly from the browser bypass the level mix entirely.
 */
export function capDifficulty(difficulty: Difficulty, level: number): Difficulty {
  const allowed = getAllowedDifficulties(level);
  return allowed.includes(difficulty) ? difficulty : (allowed.at(-1) ?? 'E');
}
