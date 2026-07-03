import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// TELEMETRY NOTE (Issue #388): PostHog events must be anonymized
// and respect user privacy/consent settings.
