import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// AUDIT NOTE (Issue #194): Resolve items from the comprehensive codebase audit
// to ensure styling consistency and code deduplication.
