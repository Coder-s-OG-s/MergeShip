export function normalizeRepoFilter(repo?: string): string | null {
  const normalized = repo?.trim();
  return normalized ? normalized : null;
}

export function repoFilterPattern(repo?: string): string | null {
  const normalized = normalizeRepoFilter(repo);
  if (!normalized) return null;
  return normalized.replace(/[\\%_]/g, (char) => `\\${char}`);
}
