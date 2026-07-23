import type { ComponentPropsWithoutRef } from 'react';
import { cn } from '@/lib/utils';

/**
 * Presentational loading placeholders for the dark maintainer/app theme.
 *
 * These primitives are intentionally dependency-free and server-safe so that
 * route-level `loading.tsx` files can compose them without pulling a client
 * bundle. Tailwind ships no bespoke shimmer utility here, so we lean on the
 * built-in `animate-pulse`; each primitive animates on its own, which keeps a
 * single primitive usable standalone as well as inside a larger layout.
 */

/**
 * Base shimmer block. Everything else is a thin wrapper around this, so the
 * pulse animation, radius, and fill colour stay defined in exactly one place.
 */
export function Skeleton({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div aria-hidden className={cn('animate-pulse rounded bg-zinc-800', className)} {...props} />
  );
}

/** A single line of text. Override the width via `className` (defaults to full width). */
export function SkeletonText({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return <Skeleton className={cn('h-4 w-full', className)} {...props} />;
}

/**
 * A bordered card matching the app's `rounded-xl border-zinc-800` panels.
 * Renders three placeholder lines by default; pass `children` to shape it to a
 * specific panel's contents.
 */
export function SkeletonCard({
  className,
  children,
  ...props
}: ComponentPropsWithoutRef<'div'>) {
  return (
    <div
      className={cn('rounded-xl border border-zinc-800 bg-zinc-900/50 p-4', className)}
      {...props}
    >
      {children ?? (
        <div className="space-y-3">
          <SkeletonText className="h-4 w-28" />
          <SkeletonText className="w-full" />
          <SkeletonText className="w-2/3" />
        </div>
      )}
    </div>
  );
}

/** A table row placeholder with `columns` evenly sized cells (defaults to 4). */
export function SkeletonTableRow({
  columns = 4,
  className,
  ...props
}: ComponentPropsWithoutRef<'div'> & { columns?: number }) {
  return (
    <div
      className={cn(
        'flex items-center gap-4 border-b border-zinc-800/60 py-3 last:border-0',
        className,
      )}
      {...props}
    >
      {Array.from({ length: columns }, (_, i) => (
        <SkeletonText key={i} className={cn('h-3.5', i === 0 ? 'flex-1' : 'w-16')} />
      ))}
    </div>
  );
}

/** A stat tile: a small label above a larger value, matching the dashboard KPIs. */
export function SkeletonStat({ className, ...props }: ComponentPropsWithoutRef<'div'>) {
  return (
    <div className={cn('space-y-3', className)} {...props}>
      <SkeletonText className="h-3 w-24 bg-zinc-800/30" />
      <SkeletonText className="h-9 w-16 bg-zinc-800/60" />
    </div>
  );
}
