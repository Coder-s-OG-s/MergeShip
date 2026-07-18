'use client';

import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';

type RepoNameTickerProps = {
  names: string[];
  intervalMs?: number;
  className?: string;
  emptyLabel?: string;
};

export function normalizeRepoNames(names: string[]): string[] {
  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const name of names) {
    const trimmed = name.trim();
    if (!trimmed || seen.has(trimmed)) continue;
    seen.add(trimmed);
    normalized.push(trimmed);
  }

  return normalized;
}

export function nextRepoIndex(currentIndex: number, total: number): number {
  if (total <= 1) return 0;
  return (currentIndex + 1) % total;
}

export function staticRepoNameText(names: string[], emptyLabel = 'No repos connected'): string {
  const normalized = normalizeRepoNames(names);
  if (normalized.length === 0) return emptyLabel;
  return normalized.join(', ');
}

export default function RepoNameTicker({
  names,
  intervalMs = 2200,
  className = '',
  emptyLabel = 'No repos connected',
}: RepoNameTickerProps) {
  const prefersReducedMotion = useReducedMotion();
  const repoNames = useMemo(() => normalizeRepoNames(names), [names]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [repoNames.length]);

  useEffect(() => {
    if (prefersReducedMotion || repoNames.length <= 1) return;

    const timer = window.setInterval(() => {
      setIndex((current) => nextRepoIndex(current, repoNames.length));
    }, intervalMs);

    return () => window.clearInterval(timer);
  }, [intervalMs, prefersReducedMotion, repoNames.length]);

  if (repoNames.length <= 1 || prefersReducedMotion) {
    return (
      <span className={`block min-w-0 truncate ${className}`}>
        {staticRepoNameText(repoNames, emptyLabel)}
      </span>
    );
  }

  const currentName = repoNames[index] ?? repoNames[0]!;

  return (
    <span
      className={`relative block min-h-6 min-w-0 overflow-hidden ${className}`}
      aria-label={`${repoNames.length} repos connected: ${repoNames.join(', ')}`}
    >
      <AnimatePresence mode="wait" initial={false}>
        <motion.span
          key={currentName}
          aria-hidden="true"
          className="block truncate"
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -6 }}
          transition={{ duration: 0.18, ease: 'easeOut' }}
        >
          {currentName}
        </motion.span>
      </AnimatePresence>
    </span>
  );
}
