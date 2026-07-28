import { describe, it, expect } from 'vitest';
import { capDifficulty, getAllowedDifficulties } from './difficulty';

describe('getAllowedDifficulties', () => {
  it('L0 only gets E', () => {
    expect(getAllowedDifficulties(0)).toEqual(['E']);
  });

  it('treats negative levels like L0', () => {
    expect(getAllowedDifficulties(-1)).toEqual(['E']);
  });

  it('L1 gets E and M', () => {
    expect(getAllowedDifficulties(1)).toEqual(['E', 'M']);
  });

  it('L2 and above get every tier', () => {
    expect(getAllowedDifficulties(2)).toEqual(['E', 'M', 'H']);
    expect(getAllowedDifficulties(5)).toEqual(['E', 'M', 'H']);
  });
});

describe('capDifficulty', () => {
  it('leaves a difficulty within the cap untouched', () => {
    expect(capDifficulty('E', 0)).toBe('E');
    expect(capDifficulty('M', 1)).toBe('M');
    expect(capDifficulty('H', 3)).toBe('H');
  });

  it('lowers an above-cap difficulty to the hardest allowed tier', () => {
    expect(capDifficulty('H', 0)).toBe('E');
    expect(capDifficulty('M', 0)).toBe('E');
    expect(capDifficulty('H', 1)).toBe('M');
  });
});
